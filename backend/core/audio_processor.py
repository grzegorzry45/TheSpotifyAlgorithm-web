"""
Core audio analysis engine using librosa
Extracts key features from audio files
"""

import librosa
import numpy as np
import pyloudnorm as pyln
from typing import Dict, List, Optional
import warnings
warnings.filterwarnings('ignore')


class AudioProcessor:
    """Process audio files and extract features"""

    def __init__(self, sr: int = 11025):
        """
        Initialize audio processor

        Args:
            sr: Sample rate for audio loading (lowered to 11025 for faster processing on free tier)
        """
        self.sr = sr
        self.meter = pyln.Meter(sr)

    def analyze_file(self, file_path: str, fast_mode: bool = True, additional_params: list = None) -> Optional[Dict]:
        """
        Analyze single audio file and extract features

        Args:
            file_path: Path to audio file
            fast_mode: If True, extract only essential features (optimized for free tier)
            additional_params: List of additional parameters to extract beyond essential ones

        Returns:
            Dictionary of audio features or None if error
        """
        print(f"DEBUG audio_processor: fast_mode={fast_mode}, additional_params={additional_params}")
        try:
            # Load audio (mono only for speed initially)
            y, sr = librosa.load(file_path, sr=self.sr, mono=True)
            y_stereo = None

            if fast_mode:
                # Check if user specified custom parameters
                if additional_params and len(additional_params) > 0:
                    # CUSTOM MODE: Use ONLY the requested parameters (no essential features)
                    print(f"DEBUG: Using CUSTOM parameters ONLY: {additional_params}")
                    features = {}

                    # Check if stereo is needed
                    stereo_params = ['stereo_width']
                    needs_stereo = any(p in additional_params for p in stereo_params)

                    if needs_stereo and y_stereo is None:
                        y_stereo, sr = librosa.load(file_path, sr=self.sr, mono=False)
                        if y_stereo.ndim == 1:
                            y_stereo = np.array([y, y])

                    # Extract ONLY the requested parameters
                    for param in additional_params:
                        features.update(self._extract_param(param, y, sr, y_stereo, features))
                else:
                    # ESSENTIAL MODE: Default essential features for basic comparison (~5-10 seconds per track)
                    print(f"DEBUG: Using ESSENTIAL parameters (default)")
                    features = {
                        'bpm': self.extract_bpm(y, sr),
                        'energy': self.extract_energy(y),
                        'loudness': self.extract_loudness(y),
                        'spectral_centroid': self.extract_spectral_centroid(y, sr),
                        'dynamic_range': self.extract_dynamic_range(y),
                        'rms': self.extract_rms(y),
                        'key': 'Unknown',  # Default value for fast mode
                    }

                return features

            # FULL MODE: All features (slower, for local use)
            # Load stereo for advanced analysis
            y_stereo, sr = librosa.load(file_path, sr=self.sr, mono=False)
            if y_stereo.ndim > 1:
                y = librosa.to_mono(y_stereo)
            else:
                y_stereo = np.array([y, y])

            # Extract basic features
            features = {
                'bpm': self.extract_bpm(y, sr),
                'energy': self.extract_energy(y),
                'loudness': self.extract_loudness(y),
                'spectral_centroid': self.extract_spectral_centroid(y, sr),
                'rms': self.extract_rms(y),
                'zero_crossing_rate': self.extract_zcr(y),
            }

            # Extract new advanced features (Tier 1)
            features['dynamic_range'] = self.extract_dynamic_range(y)
            features['spectral_rolloff'] = self.extract_spectral_rolloff(y, sr)
            features['spectral_flatness'] = self.extract_spectral_flatness(y, sr)

            # Energy distribution
            energy_dist = self.extract_energy_distribution(y, sr)
            features['low_energy'] = energy_dist['low']
            features['mid_energy'] = energy_dist['mid']
            features['high_energy'] = energy_dist['high']

            # Key detection
            key_data = self.extract_key(y, sr)
            features['key'] = key_data['key']
            features['key_confidence'] = key_data['confidence']

            # Extract Tier 2 features
            features['danceability'] = self.extract_danceability(y, sr, features['bpm'])
            features['beat_strength'] = self.extract_beat_strength(y, sr)
            features['sub_bass_presence'] = self.extract_sub_bass_presence(y, sr)
            features['stereo_width'] = self.extract_stereo_width(y_stereo)
            features['valence'] = self.extract_valence(y, sr, features)

            # Extract Tier 3 features (Production-critical)
            features['loudness_range'] = self.extract_loudness_range(y)
            features['true_peak'] = self.extract_true_peak(y)
            features['crest_factor'] = self.extract_crest_factor(y)
            features['spectral_contrast'] = self.extract_spectral_contrast(y, sr)
            features['transient_energy'] = self.extract_transient_energy(y, sr)
            features['harmonic_to_noise_ratio'] = self.extract_harmonic_to_noise_ratio(y, sr)

            # Extract Tier 4 features (Composition & Arrangement)
            features['harmonic_complexity'] = self.extract_harmonic_complexity(y, sr)
            features['melodic_range'] = self.extract_melodic_range(y, sr)
            features['rhythmic_density'] = self.extract_rhythmic_density(y, sr)
            features['arrangement_density'] = self.extract_arrangement_density(y, sr)
            features['repetition_score'] = self.extract_repetition_score(y, sr)
            features['frequency_occupancy'] = self.extract_frequency_occupancy(y, sr)
            features['timbral_diversity'] = self.extract_timbral_diversity(y, sr)
            features['vocal_instrumental_ratio'] = self.extract_vocal_instrumental_ratio(y, sr)
            features['energy_curve'] = self.extract_energy_curve(y, sr)
            features['call_response_presence'] = self.extract_call_response(y, sr)

            return features

        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
            return None

    def extract_bpm(self, y: np.ndarray, sr: int) -> float:
        """
        Extract tempo (BPM)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            BPM value
        """
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return float(tempo)

    def extract_energy(self, y: np.ndarray) -> float:
        """
        Extract energy (average amplitude)

        Args:
            y: Audio time series

        Returns:
            Energy value (0-1)
        """
        energy = np.sum(y**2) / len(y)
        return float(energy)

    def extract_loudness(self, y: np.ndarray) -> float:
        """
        Extract loudness in LUFS

        Args:
            y: Audio time series

        Returns:
            Loudness in LUFS
        """
        try:
            loudness = self.meter.integrated_loudness(y)
            return float(loudness)
        except:
            # Fallback to RMS-based estimation
            rms = np.sqrt(np.mean(y**2))
            loudness = 20 * np.log10(rms + 1e-10)
            return float(loudness)

    def extract_spectral_centroid(self, y: np.ndarray, sr: int) -> float:
        """
        Extract spectral centroid (brightness)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Average spectral centroid in Hz
        """
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        return float(np.mean(centroid))

    def extract_rms(self, y: np.ndarray) -> float:
        """
        Extract RMS energy

        Args:
            y: Audio time series

        Returns:
            RMS energy value
        """
        rms = librosa.feature.rms(y=y)
        return float(np.mean(rms))

    def extract_zcr(self, y: np.ndarray) -> float:
        """
        Extract zero crossing rate

        Args:
            y: Audio time series

        Returns:
            Average zero crossing rate
        """
        zcr = librosa.feature.zero_crossing_rate(y)
        return float(np.mean(zcr))

    def calculate_profile(self, features_list: List[Dict]) -> Dict:
        """
        Calculate statistical profile from multiple tracks

        Args:
            features_list: List of feature dictionaries

        Returns:
            Profile with mean, std, min, max for each feature
        """
        if not features_list:
            return {}

        profile = {}
        feature_keys = features_list[0].keys()

        for key in feature_keys:
            values = [f[key] for f in features_list if key in f]

            if values:
                # Skip string values (like 'key')
                if isinstance(values[0], str):
                    # For string values, find the most common
                    from collections import Counter
                    counter = Counter(values)
                    most_common = counter.most_common(1)[0][0]
                    profile[key] = {
                        'mean': most_common,
                        'std': '',
                        'min': '',
                        'max': '',
                        'median': most_common
                    }
                else:
                    # Numerical values
                    profile[key] = {
                        'mean': float(np.mean(values)),
                        'std': float(np.std(values)),
                        'min': float(np.min(values)),
                        'max': float(np.max(values)),
                        'median': float(np.median(values))
                    }

        return profile

    # ==================== TIER 1 FEATURES ====================

    def extract_dynamic_range(self, y: np.ndarray) -> float:
        """
        Extract dynamic range (DR) in dB
        Difference between peak and RMS levels

        Args:
            y: Audio time series

        Returns:
            Dynamic range in dB
        """
        peak = np.max(np.abs(y))
        rms = np.sqrt(np.mean(y**2))

        if rms > 0 and peak > 0:
            dr = 20 * np.log10(peak / rms)
            return float(dr)
        return 0.0

    def extract_spectral_rolloff(self, y: np.ndarray, sr: int) -> float:
        """
        Extract spectral rolloff (frequency below which 85% of energy is contained)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Average spectral rolloff in Hz
        """
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
        return float(np.mean(rolloff))

    def extract_spectral_flatness(self, y: np.ndarray, sr: int) -> float:
        """
        Extract spectral flatness (tonality vs noisiness)
        0 = tonal, 1 = noise-like

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Average spectral flatness (0-1)
        """
        flatness = librosa.feature.spectral_flatness(y=y)
        return float(np.mean(flatness))

    def extract_energy_distribution(self, y: np.ndarray, sr: int) -> Dict:
        """
        Extract energy distribution across frequency bands

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Dictionary with low, mid, high energy percentages
        """
        # Compute STFT
        S = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)

        # Define frequency bands
        low_band = (freqs >= 20) & (freqs < 250)
        mid_band = (freqs >= 250) & (freqs < 4000)
        high_band = (freqs >= 4000) & (freqs <= sr/2)

        # Calculate energy in each band
        low_energy = np.sum(S[low_band, :])
        mid_energy = np.sum(S[mid_band, :])
        high_energy = np.sum(S[high_band, :])

        total_energy = low_energy + mid_energy + high_energy

        if total_energy > 0:
            return {
                'low': float(low_energy / total_energy * 100),
                'mid': float(mid_energy / total_energy * 100),
                'high': float(high_energy / total_energy * 100)
            }
        return {'low': 0.0, 'mid': 0.0, 'high': 0.0}

    def extract_key(self, y: np.ndarray, sr: int) -> Dict:
        """
        Extract musical key and mode

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Dictionary with key name and confidence
        """
        try:
            # Compute chroma features
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)

            # Key names
            keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

            # Find dominant key (max chroma)
            key_idx = np.argmax(chroma_mean)
            confidence = float(chroma_mean[key_idx] / np.sum(chroma_mean))

            # Detect major/minor (simplified)
            # Major keys have strong tonic, third, and fifth
            # This is a basic heuristic
            major_intervals = [0, 4, 7]  # Tonic, major third, fifth
            minor_intervals = [0, 3, 7]  # Tonic, minor third, fifth

            major_score = sum(chroma_mean[(key_idx + i) % 12] for i in major_intervals)
            minor_score = sum(chroma_mean[(key_idx + i) % 12] for i in minor_intervals)

            mode = 'Major' if major_score > minor_score else 'Minor'

            return {
                'key': f"{keys[key_idx]} {mode}",
                'confidence': confidence
            }
        except:
            return {'key': 'Unknown', 'confidence': 0.0}

    # ==================== TIER 2 FEATURES ====================

    def extract_danceability(self, y: np.ndarray, sr: int, bpm: float) -> float:
        """
        Extract danceability score (0-1)
        Based on rhythm regularity, beat strength, and tempo

        Args:
            y: Audio time series
            sr: Sample rate
            bpm: Tempo in BPM

        Returns:
            Danceability score (0-1)
        """
        try:
            # Beat strength component
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            beat_strength = float(np.mean(onset_env))

            # Tempo component (optimal dance tempo around 120 BPM)
            tempo_score = 1.0 - abs(bpm - 120) / 120
            tempo_score = max(0, min(1, tempo_score))

            # Rhythm regularity (via autocorrelation of onset envelope)
            onset_autocorr = librosa.autocorrelate(onset_env)
            regularity = float(np.max(onset_autocorr[1:50]) / onset_autocorr[0]) if onset_autocorr[0] > 0 else 0

            # Combine factors
            danceability = (beat_strength * 0.4 + tempo_score * 0.3 + regularity * 0.3)

            return float(np.clip(danceability, 0, 1))
        except:
            return 0.5

    def extract_beat_strength(self, y: np.ndarray, sr: int) -> float:
        """
        Extract beat strength (how prominent the beats are)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Beat strength value
        """
        try:
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            return float(np.mean(onset_env))
        except:
            return 0.0

    def extract_sub_bass_presence(self, y: np.ndarray, sr: int) -> float:
        """
        Extract sub-bass presence (20-60 Hz)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Sub-bass energy as percentage of total
        """
        try:
            # Compute STFT
            S = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            # Sub-bass band (20-60 Hz)
            sub_bass_band = (freqs >= 20) & (freqs < 60)

            # Calculate energy
            sub_bass_energy = np.sum(S[sub_bass_band, :])
            total_energy = np.sum(S)

            if total_energy > 0:
                return float(sub_bass_energy / total_energy * 100)
            return 0.0
        except:
            return 0.0

    def extract_stereo_width(self, y_stereo: np.ndarray) -> float:
        """
        Extract stereo width (0 = mono, 1 = wide stereo)

        Args:
            y_stereo: Stereo audio time series (2, N)

        Returns:
            Stereo width (0-1)
        """
        try:
            if y_stereo.ndim == 1 or y_stereo.shape[0] == 1:
                return 0.0  # Mono

            left = y_stereo[0]
            right = y_stereo[1]

            # Calculate correlation
            correlation = np.corrcoef(left, right)[0, 1]

            # Convert correlation to width (1 = identical/mono, -1 = opposite phase)
            # Width: 0 = mono (high correlation), 1 = wide (low correlation)
            width = 1.0 - abs(correlation)

            return float(np.clip(width, 0, 1))
        except:
            return 0.5

    def extract_valence(self, y: np.ndarray, sr: int, features: Dict) -> float:
        """
        Extract valence (emotional positivity)
        0 = sad/negative, 1 = happy/positive

        Heuristic based on:
        - Tempo (faster = happier)
        - Mode (major = happier)
        - Brightness (brighter = happier)
        - Energy (higher = more positive)

        Args:
            y: Audio time series
            sr: Sample rate
            features: Already extracted features

        Returns:
            Valence score (0-1)
        """
        try:
            # Tempo component
            bpm = features.get('bpm', 120)
            tempo_score = min(1.0, bpm / 140)  # Higher tempo = more positive

            # Brightness component
            centroid = features.get('spectral_centroid', 2000)
            brightness_score = min(1.0, centroid / 3000)

            # Energy component
            energy = features.get('energy', 0.5)
            energy_score = min(1.0, energy * 2)

            # Key mode component (if available)
            key = features.get('key', 'Unknown')
            mode_score = 0.7 if 'Major' in key else 0.3

            # Combine
            valence = (tempo_score * 0.25 + brightness_score * 0.25 +
                      energy_score * 0.25 + mode_score * 0.25)

            return float(np.clip(valence, 0, 1))
        except:
            return 0.5

    def extract_loudness_range(self, y: np.ndarray) -> float:
        """
        Extract Loudness Range (LRA) in LU (Loudness Units)
        Critical for streaming platforms - shows dynamic variation

        Args:
            y: Audio time series

        Returns:
            Loudness Range in LU
        """
        try:
            # Compute short-term loudness (3 second window)
            hop_length = self.sr * 3  # 3 second hops
            loudness_values = []

            for i in range(0, len(y) - hop_length, hop_length):
                segment = y[i:i + hop_length]
                if len(segment) > 0:
                    loudness = self.meter.integrated_loudness(segment)
                    if np.isfinite(loudness) and loudness > -70:  # Ignore silence
                        loudness_values.append(loudness)

            if len(loudness_values) > 1:
                # LRA = difference between 95th and 10th percentile
                lra = np.percentile(loudness_values, 95) - np.percentile(loudness_values, 10)
                return float(max(0, lra))
            return 0.0
        except:
            return 0.0

    def extract_true_peak(self, y: np.ndarray) -> float:
        """
        Extract True Peak in dBTP (dB True Peak)
        Critical for mastering - must be below -1.0 dBTP for streaming

        Args:
            y: Audio time series

        Returns:
            True Peak in dBTP
        """
        try:
            # Oversample to catch inter-sample peaks (4x oversampling)
            y_oversampled = librosa.resample(y, orig_sr=self.sr, target_sr=self.sr * 4)

            # Find absolute peak
            peak = np.max(np.abs(y_oversampled))

            # Convert to dBTP
            if peak > 0:
                true_peak_db = 20 * np.log10(peak)
                return float(true_peak_db)
            return -np.inf
        except:
            return -6.0  # Safe default

    def extract_crest_factor(self, y: np.ndarray) -> float:
        """
        Extract Crest Factor (Peak to RMS ratio) in dB
        Shows "punchiness" - high = dynamic/punchy, low = compressed/dense

        Args:
            y: Audio time series

        Returns:
            Crest Factor in dB
        """
        try:
            peak = np.max(np.abs(y))
            rms = np.sqrt(np.mean(y**2))

            if rms > 0:
                crest_factor = peak / rms
                crest_factor_db = 20 * np.log10(crest_factor)
                return float(crest_factor_db)
            return 0.0
        except:
            return 0.0

    def extract_spectral_contrast(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Spectral Contrast
        Shows difference between peaks and valleys in spectrum
        High = punchy/clear, Low = smooth/muddy

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Mean spectral contrast (dB)
        """
        try:
            contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
            # Return mean contrast across all bands
            return float(np.mean(contrast))
        except:
            return 0.0

    def extract_transient_energy(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Transient Energy as percentage of total energy
        Shows how much energy is in attacks vs sustained sounds
        High = percussive/rhythmic, Low = smooth/sustained

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Transient energy percentage (0-100)
        """
        try:
            # Separate harmonic and percussive components
            y_harmonic, y_percussive = librosa.effects.hpss(y)

            # Calculate energy in each
            energy_percussive = np.sum(y_percussive**2)
            energy_total = np.sum(y**2)

            if energy_total > 0:
                transient_percent = (energy_percussive / energy_total) * 100
                return float(transient_percent)
            return 0.0
        except:
            return 0.0

    def extract_harmonic_to_noise_ratio(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Harmonic-to-Noise Ratio (HNR) in dB
        Shows tonality vs noise/breathiness
        High = tonal/melodic, Low = noisy/breathy (lo-fi, vocals, etc.)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            HNR in dB
        """
        try:
            # Separate harmonic and percussive (percussive = "noise" component)
            y_harmonic, y_percussive = librosa.effects.hpss(y, margin=2.0)

            # Calculate power in each
            power_harmonic = np.sum(y_harmonic**2)
            power_noise = np.sum(y_percussive**2)

            if power_noise > 0:
                hnr = 10 * np.log10(power_harmonic / power_noise)
                return float(hnr)
            return 20.0  # Very high = almost pure tonal
        except:
            return 10.0  # Neutral default

    def extract_harmonic_complexity(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Harmonic Complexity (0-1)
        Measures chord/harmonic richness
        Low = simple (pop), High = complex (jazz/prog)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Harmonic complexity score (0-1)
        """
        try:
            # Use chroma features to analyze harmony
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

            # Calculate unique pitch class usage
            pitch_class_strength = np.mean(chroma, axis=1)
            active_pitches = np.sum(pitch_class_strength > 0.1)  # How many pitch classes are used

            # Calculate harmonic change rate (chord changes)
            chroma_diff = np.diff(chroma, axis=1)
            change_rate = np.mean(np.abs(chroma_diff))

            # Combine: more active pitches + more changes = more complex
            complexity = (active_pitches / 12.0) * 0.6 + change_rate * 0.4

            return float(np.clip(complexity, 0, 1))
        except:
            return 0.5

    def extract_melodic_range(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Melodic Range in semitones
        Measures pitch span from lowest to highest
        Narrow = monotonous, Wide = dramatic

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Melodic range in semitones
        """
        try:
            # Extract pitch using piptrack
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)

            # Get pitch values where magnitude is significant
            pitch_values = []
            for t in range(pitches.shape[1]):
                index = magnitudes[:, t].argmax()
                pitch = pitches[index, t]
                if pitch > 0:  # Valid pitch detected
                    pitch_values.append(pitch)

            if len(pitch_values) > 0:
                # Convert to MIDI notes
                midi_notes = librosa.hz_to_midi(pitch_values)
                melodic_range = np.max(midi_notes) - np.min(midi_notes)
                return float(melodic_range)

            return 12.0  # Default ~1 octave
        except:
            return 12.0

    def extract_rhythmic_density(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Rhythmic Density (events per second)
        How busy is the rhythm?
        Low = sparse/minimal, High = dense/complex

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Rhythmic density (events/second)
        """
        try:
            # Detect onsets (rhythmic events)
            onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
            duration = librosa.get_duration(y=y, sr=sr)

            if duration > 0:
                events_per_second = len(onset_frames) / duration
                return float(events_per_second)

            return 0.0
        except:
            return 0.0

    def extract_arrangement_density(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Arrangement Density variation (0-1)
        How much does the density change over time?
        Low = static, High = dynamic build-ups/breakdowns

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Arrangement density variation (0-1)
        """
        try:
            # Calculate RMS in segments
            hop_length = sr * 2  # 2-second segments
            rms_segments = []

            for i in range(0, len(y) - hop_length, hop_length):
                segment = y[i:i + hop_length]
                rms = np.sqrt(np.mean(segment**2))
                rms_segments.append(rms)

            if len(rms_segments) > 1:
                # Standard deviation of density = how much it varies
                variation = np.std(rms_segments) / (np.mean(rms_segments) + 1e-6)
                return float(np.clip(variation, 0, 1))

            return 0.0
        except:
            return 0.0

    def extract_repetition_score(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Repetition Score (0-1)
        How repetitive is the track?
        High = repetitive (pop hooks), Low = through-composed (prog)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Repetition score (0-1)
        """
        try:
            # Use chroma features for harmonic repetition
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

            # Calculate self-similarity matrix
            similarity_matrix = np.corrcoef(chroma.T)

            # Average off-diagonal similarity (how similar sections are to each other)
            mask = ~np.eye(similarity_matrix.shape[0], dtype=bool)
            repetition = np.mean(similarity_matrix[mask])

            return float(np.clip(repetition, 0, 1))
        except:
            return 0.5

    def extract_frequency_occupancy(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Frequency Occupancy center (Hz)
        Where is the "center of gravity" of the track?
        Low = bass-focused, Mid = vocal-focused, High = bright

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Center frequency (Hz)
        """
        try:
            # Calculate weighted average frequency
            S = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            # Weight each frequency by its energy
            energy_per_freq = np.sum(S, axis=1)
            center_freq = np.sum(freqs * energy_per_freq) / np.sum(energy_per_freq)

            return float(center_freq)
        except:
            return 1000.0  # Mid-range default

    def extract_timbral_diversity(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Timbral Diversity (0-1)
        How varied are the timbres/textures?
        Low = one main sound, High = many different instruments/textures

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Timbral diversity score (0-1)
        """
        try:
            # Use MFCC (Mel-frequency cepstral coefficients) for timbre
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

            # Calculate variance across time for each MFCC
            mfcc_variance = np.var(mfccs, axis=1)

            # High variance = more timbral changes = more diversity
            diversity = np.mean(mfcc_variance)

            # Normalize to 0-1 range (empirical scaling)
            diversity_normalized = diversity / 100.0

            return float(np.clip(diversity_normalized, 0, 1))
        except:
            return 0.5

    def extract_vocal_instrumental_ratio(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Vocal-to-Instrumental Ratio (0-1)
        0 = pure instrumental, 1 = vocals throughout
        Estimates based on spectral characteristics

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Vocal ratio (0-1)
        """
        try:
            # Vocals typically occupy 200-4000 Hz range with specific spectral shape
            S = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            # Vocal frequency band
            vocal_band = (freqs >= 200) & (freqs <= 4000)
            vocal_energy = np.sum(S[vocal_band, :])

            # Total energy
            total_energy = np.sum(S)

            if total_energy > 0:
                vocal_ratio = vocal_energy / total_energy
                return float(np.clip(vocal_ratio, 0, 1))

            return 0.5
        except:
            return 0.5

    def extract_energy_curve(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Energy Curve variation (0-1)
        How much does energy change through the song?
        Low = flat energy, High = dramatic energy arc (verses/chorus)

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Energy curve variation (0-1)
        """
        try:
            # Calculate energy over time in segments
            hop_length = sr * 4  # 4-second segments
            energy_segments = []

            for i in range(0, len(y) - hop_length, hop_length):
                segment = y[i:i + hop_length]
                energy = np.sum(segment**2)
                energy_segments.append(energy)

            if len(energy_segments) > 2:
                # Calculate coefficient of variation
                energy_curve_var = np.std(energy_segments) / (np.mean(energy_segments) + 1e-6)
                return float(np.clip(energy_curve_var, 0, 1))

            return 0.0
        except:
            return 0.0

    def extract_call_response(self, y: np.ndarray, sr: int) -> float:
        """
        Extract Call-and-Response Presence (0-1)
        Detects musical dialogue patterns
        High = lots of back-and-forth, Low = continuous

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Call-response score (0-1)
        """
        try:
            # Analyze onset patterns for rhythmic call-response
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)

            # Calculate autocorrelation to find repeating patterns
            onset_autocorr = librosa.autocorrelate(onset_env)

            # Look for peaks in autocorrelation (indicating repetitive patterns)
            # Call-response typically has patterns repeating at regular intervals
            peaks = []
            for i in range(10, min(100, len(onset_autocorr))):
                if onset_autocorr[i] > onset_autocorr[i-1] and onset_autocorr[i] > onset_autocorr[i+1]:
                    peaks.append(onset_autocorr[i])

            if len(peaks) > 0:
                # More prominent peaks = more call-response patterns
                call_response_score = np.mean(peaks) / onset_autocorr[0]
                return float(np.clip(call_response_score, 0, 1))

            return 0.0
        except:
            return 0.0


    def _extract_param(self, param: str, y: np.ndarray, sr: int, y_stereo: np.ndarray = None, features: dict = None) -> dict:
        """Extract a single parameter dynamically"""
        result = {}
        features = features or {}

        try:
            # Tier 1
            if param == 'spectral_rolloff':
                result[param] = self.extract_spectral_rolloff(y, sr)
            elif param == 'spectral_flatness':
                result[param] = self.extract_spectral_flatness(y, sr)
            elif param == 'zero_crossing_rate':
                result[param] = self.extract_zcr(y)
            # Tier 1B
            elif param in ['low_energy', 'mid_energy', 'high_energy']:
                energy_dist = self.extract_energy_distribution(y, sr)
                result[param] = energy_dist[param.split('_')[0]]
            # Tier 2
            elif param == 'danceability':
                bpm = features.get('bpm', self.extract_bpm(y, sr))
                result[param] = self.extract_danceability(y, sr, bpm)
            elif param == 'beat_strength':
                result[param] = self.extract_beat_strength(y, sr)
            elif param == 'sub_bass_presence':
                result[param] = self.extract_sub_bass_presence(y, sr)
            elif param == 'stereo_width':
                result[param] = self.extract_stereo_width(y_stereo) if y_stereo is not None else 0.0
            elif param == 'valence':
                result[param] = self.extract_valence(y, sr, features)
            elif param == 'key_confidence':
                key_data = self.extract_key(y, sr)
                result['key'], result['key_confidence'] = key_data['key'], key_data['confidence']
            # Tier 3
            elif param == 'loudness_range':
                result[param] = self.extract_loudness_range(y)
            elif param == 'true_peak':
                result[param] = self.extract_true_peak(y)
            elif param == 'crest_factor':
                result[param] = self.extract_crest_factor(y)
            elif param == 'spectral_contrast':
                result[param] = self.extract_spectral_contrast(y, sr)
            elif param == 'transient_energy':
                result[param] = self.extract_transient_energy(y, sr)
            elif param == 'harmonic_to_noise_ratio':
                result[param] = self.extract_harmonic_to_noise_ratio(y, sr)
            # Tier 4
            elif param == 'harmonic_complexity':
                result[param] = self.extract_harmonic_complexity(y, sr)
            elif param == 'melodic_range':
                result[param] = self.extract_melodic_range(y, sr)
            elif param == 'rhythmic_density':
                result[param] = self.extract_rhythmic_density(y, sr)
            elif param == 'arrangement_density':
                result[param] = self.extract_arrangement_density(y, sr)
            elif param == 'repetition_score':
                result[param] = self.extract_repetition_score(y, sr)
            elif param == 'frequency_occupancy':
                result[param] = self.extract_frequency_occupancy(y, sr)
            elif param == 'timbral_diversity':
                result[param] = self.extract_timbral_diversity(y, sr)
            elif param == 'vocal_instrumental_ratio':
                result[param] = self.extract_vocal_instrumental_ratio(y, sr)
            elif param == 'energy_curve':
                result[param] = self.extract_energy_curve(y, sr)
            elif param == 'call_response_presence':
                result[param] = self.extract_call_response(y, sr)
        except Exception as e:
            print(f"Error extracting {param}: {e}")
            result[param] = 0.0

        # Validate extracted values - replace NaN/inf with safe defaults
        for key, value in result.items():
            if isinstance(value, (int, float)):
                if np.isnan(value) or np.isinf(value):
                    print(f"Warning: {key} returned invalid value ({value}), using 0.0")
                    result[key] = 0.0

        return result

