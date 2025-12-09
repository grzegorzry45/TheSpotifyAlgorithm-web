"""
Track to Track Comparator - AI Assistant for 1:1 comparisons
Generates actionable recommendations when comparing two tracks directly
"""

from typing import Dict, List


class TrackComparator:
    """Compare two tracks directly and generate recommendations"""

    def __init__(self, reference_track: Dict):
        """
        Initialize comparator with reference track

        Args:
            reference_track: Features of reference track
        """
        self.reference = reference_track

        # Tolerance levels (percentage differences)
        self.tolerance = {
            'perfect': 5,    # Within 5%
            'good': 15,      # Within 15%
            'warning': 30,   # Within 30%
            'critical': 100  # Beyond 30%
        }

    def compare_track(self, your_track: Dict) -> List[Dict]:
        """
        Compare your track against reference track

        Args:
            your_track: Features of your track

        Returns:
            List of recommendations with status and messages
        """
        recommendations = []

        # Calculate overall match score
        score = self.calculate_match_score(your_track)
        recommendations.append({
            'status': self.get_score_status(score),
            'message': f"Overall match: {score}% similar to reference track",
            'score': score
        })

        # Core features - only compare if both tracks have the parameter
        if 'bpm' in your_track and 'bpm' in self.reference:
            recommendations.append(self.compare_bpm(your_track['bpm']))
        if 'key' in your_track and 'key' in self.reference:
            recommendations.append(self.compare_key(your_track.get('key', 'Unknown')))
        if 'energy' in your_track and 'energy' in self.reference:
            recommendations.append(self.compare_energy(your_track['energy']))
        if 'loudness' in your_track and 'loudness' in self.reference:
            recommendations.append(self.compare_loudness(your_track['loudness']))

        # Spectral features
        if 'spectral_centroid' in your_track and 'spectral_centroid' in self.reference:
            recommendations.append(self.compare_brightness(your_track['spectral_centroid']))
        if 'spectral_rolloff' in your_track and 'spectral_rolloff' in self.reference:
            recommendations.append(self.compare_spectral_rolloff(your_track.get('spectral_rolloff', 0)))
        if 'spectral_flatness' in your_track and 'spectral_flatness' in self.reference:
            recommendations.append(self.compare_spectral_flatness(your_track.get('spectral_flatness', 0)))
        if 'spectral_contrast' in your_track and 'spectral_contrast' in self.reference:
            recommendations.append(self.compare_spectral_contrast(your_track.get('spectral_contrast', 0)))

        # Energy distribution
        if 'low_energy' in your_track and 'low_energy' in self.reference:
            recommendations.append(self.compare_low_energy(your_track.get('low_energy', 0)))
        if 'mid_energy' in your_track and 'mid_energy' in self.reference:
            recommendations.append(self.compare_mid_energy(your_track.get('mid_energy', 0)))
        if 'high_energy' in your_track and 'high_energy' in self.reference:
            recommendations.append(self.compare_high_energy(your_track.get('high_energy', 0)))
        if 'sub_bass_presence' in your_track and 'sub_bass_presence' in self.reference:
            recommendations.append(self.compare_sub_bass(your_track.get('sub_bass_presence', 0)))

        # Dynamics & Loudness
        if 'dynamic_range' in your_track and 'dynamic_range' in self.reference:
            recommendations.append(self.compare_dynamic_range(your_track.get('dynamic_range', 0)))
        if 'rms' in your_track and 'rms' in self.reference:
            recommendations.append(self.compare_rms(your_track['rms']))
        if 'loudness_range' in your_track and 'loudness_range' in self.reference:
            recommendations.append(self.compare_loudness_range(your_track.get('loudness_range', 0)))
        if 'true_peak' in your_track and 'true_peak' in self.reference:
            recommendations.append(self.compare_true_peak(your_track.get('true_peak', 0)))
        if 'crest_factor' in your_track and 'crest_factor' in self.reference:
            recommendations.append(self.compare_crest_factor(your_track.get('crest_factor', 0)))

        # Perceptual features
        if 'danceability' in your_track and 'danceability' in self.reference:
            recommendations.append(self.compare_danceability(your_track.get('danceability', 0)))
        if 'beat_strength' in your_track and 'beat_strength' in self.reference:
            recommendations.append(self.compare_beat_strength(your_track.get('beat_strength', 0)))
        if 'valence' in your_track and 'valence' in self.reference:
            recommendations.append(self.compare_valence(your_track.get('valence', 0)))
        if 'stereo_width' in your_track and 'stereo_width' in self.reference:
            recommendations.append(self.compare_stereo_width(your_track.get('stereo_width', 0)))
        if 'transient_energy' in your_track and 'transient_energy' in self.reference:
            recommendations.append(self.compare_transient_energy(your_track.get('transient_energy', 0)))
        if 'harmonic_to_noise_ratio' in your_track and 'harmonic_to_noise_ratio' in self.reference:
            recommendations.append(self.compare_harmonic_to_noise(your_track.get('harmonic_to_noise_ratio', 0)))

        # Composition & Arrangement features
        if 'harmonic_complexity' in your_track and 'harmonic_complexity' in self.reference:
            recommendations.append(self.compare_harmonic_complexity(your_track.get('harmonic_complexity', 0)))
        if 'melodic_range' in your_track and 'melodic_range' in self.reference:
            recommendations.append(self.compare_melodic_range(your_track.get('melodic_range', 0)))
        if 'rhythmic_density' in your_track and 'rhythmic_density' in self.reference:
            recommendations.append(self.compare_rhythmic_density(your_track.get('rhythmic_density', 0)))
        if 'arrangement_density' in your_track and 'arrangement_density' in self.reference:
            recommendations.append(self.compare_arrangement_density(your_track.get('arrangement_density', 0)))
        if 'repetition_score' in your_track and 'repetition_score' in self.reference:
            recommendations.append(self.compare_repetition_score(your_track.get('repetition_score', 0)))
        if 'frequency_occupancy' in your_track and 'frequency_occupancy' in self.reference:
            recommendations.append(self.compare_frequency_occupancy(your_track.get('frequency_occupancy', 0)))
        if 'timbral_diversity' in your_track and 'timbral_diversity' in self.reference:
            recommendations.append(self.compare_timbral_diversity(your_track.get('timbral_diversity', 0)))
        if 'vocal_instrumental_ratio' in your_track and 'vocal_instrumental_ratio' in self.reference:
            recommendations.append(self.compare_vocal_instrumental(your_track.get('vocal_instrumental_ratio', 0)))
        if 'energy_curve' in your_track and 'energy_curve' in self.reference:
            recommendations.append(self.compare_energy_curve(your_track.get('energy_curve', 0)))
        if 'call_response_presence' in your_track and 'call_response_presence' in self.reference:
            recommendations.append(self.compare_call_response(your_track.get('call_response_presence', 0)))

        return recommendations

    def calculate_match_score(self, your_track: Dict) -> float:
        """
        Calculate overall match score (0-100)

        Args:
            your_track: Your track features

        Returns:
            Match score percentage
        """
        scores = []

        # Use key numeric features for score calculation
        numeric_features = [
            'bpm', 'energy', 'loudness', 'spectral_centroid', 'rms',
            'spectral_rolloff', 'spectral_flatness', 'spectral_contrast', 'dynamic_range',
            'danceability', 'beat_strength', 'valence', 'stereo_width',
            'low_energy', 'mid_energy', 'high_energy', 'sub_bass_presence',
            'loudness_range', 'true_peak', 'crest_factor', 'transient_energy', 'harmonic_to_noise_ratio',
            'harmonic_complexity', 'melodic_range', 'rhythmic_density', 'arrangement_density',
            'repetition_score', 'frequency_occupancy', 'timbral_diversity', 'vocal_instrumental_ratio',
            'energy_curve', 'call_response_presence'
        ]

        for key in numeric_features:
            if key in your_track and key in self.reference:
                your_val = your_track[key]
                ref_val = self.reference[key]

                # Skip non-numeric values
                if isinstance(your_val, str) or isinstance(ref_val, str):
                    continue
                if your_val is None or ref_val is None:
                    continue

                # Skip if either value is 0
                if ref_val == 0:
                    continue

                try:
                    # Calculate percentage difference
                    diff_percent = abs((your_val - ref_val) / ref_val * 100)
                    # Convert to similarity score (0-100)
                    score = max(0, 100 - (diff_percent * 1.5))  # 66% diff = 0 score
                    scores.append(score)
                except (TypeError, ValueError, ZeroDivisionError):
                    # Skip problematic values
                    continue

        return round(sum(scores) / len(scores), 1) if scores else 0.0

    def get_score_status(self, score: float) -> str:
        """Get status based on score"""
        if score >= 80:
            return 'perfect'
        elif score >= 60:
            return 'good'
        elif score >= 40:
            return 'warning'
        else:
            return 'critical'

    def compare_bpm(self, your_bpm: float) -> Dict:
        """Generate BPM recommendation"""
        ref_bpm = self.reference['bpm']
        diff = your_bpm - ref_bpm
        diff_percent = abs(diff / ref_bpm * 100) if ref_bpm != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"BPM: {your_bpm:.1f} - Nearly identical to reference ({ref_bpm:.1f})!"
            }
        elif diff_percent <= self.tolerance['good']:
            direction = "faster" if diff > 0 else "slower"
            return {
                'status': 'good',
                'message': f"BPM: {your_bpm:.1f} - Slightly {direction} than reference ({ref_bpm:.1f}, {diff_percent:.1f}% diff)"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "Speed up" if diff < 0 else "Slow down"
            return {
                'status': 'warning',
                'message': f"BPM: {your_bpm:.1f} - {direction} by {abs(diff):.0f} BPM to match reference ({ref_bpm:.1f})"
            }
        else:
            direction = "Much faster" if diff > 0 else "Much slower"
            return {
                'status': 'critical',
                'message': f"BPM: {your_bpm:.1f} - {direction} than reference ({ref_bpm:.1f}). Consider: Are you matching the right style?"
            }

    def compare_energy(self, your_energy: float) -> Dict:
        """Generate energy recommendation"""
        ref_energy = self.reference['energy']
        diff = your_energy - ref_energy
        diff_percent = abs(diff / ref_energy * 100) if ref_energy != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Energy: {your_energy:.3f} - Perfect match with reference!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Energy: {your_energy:.3f} - Very close to reference ({ref_energy:.3f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "more energetic" if diff > 0 else "less energetic"
            suggestion = "Reduce compression/intensity" if diff > 0 else "Increase compression/intensity"
            return {
                'status': 'warning',
                'message': f"Energy: {your_energy:.3f} - Your track is {direction}. {suggestion} to match reference ({ref_energy:.3f})"
            }
        else:
            direction = "Much more intense" if diff > 0 else "Much less intense"
            return {
                'status': 'critical',
                'message': f"Energy: {your_energy:.3f} - {direction} than reference ({ref_energy:.3f}). Major mixing adjustments needed!"
            }

    def compare_loudness(self, your_loudness: float) -> Dict:
        """Generate loudness recommendation"""
        ref_loudness = self.reference['loudness']
        diff = your_loudness - ref_loudness
        diff_percent = abs(diff / ref_loudness * 100) if ref_loudness != 0 else 0

        # For loudness, absolute difference in dB is more meaningful
        abs_diff = abs(diff)

        if abs_diff <= 0.5:
            return {
                'status': 'perfect',
                'message': f"Loudness: {your_loudness:.1f} LUFS - Perfectly matched to reference!"
            }
        elif abs_diff <= 1.5:
            direction = "louder" if diff > 0 else "quieter"
            return {
                'status': 'good',
                'message': f"Loudness: {your_loudness:.1f} LUFS - Slightly {direction} than reference ({ref_loudness:.1f} LUFS, {abs_diff:.1f}dB diff)"
            }
        elif abs_diff <= 3.0:
            direction = "Reduce" if diff > 0 else "Increase"
            return {
                'status': 'warning',
                'message': f"Loudness: {your_loudness:.1f} LUFS - {direction} mastering by {abs_diff:.1f}dB to match reference ({ref_loudness:.1f} LUFS)"
            }
        else:
            direction = "Much too loud" if diff > 0 else "Much too quiet"
            return {
                'status': 'critical',
                'message': f"Loudness: {your_loudness:.1f} LUFS - {direction}! Adjust mastering by {abs_diff:.1f}dB (reference: {ref_loudness:.1f} LUFS)"
            }

    def compare_brightness(self, your_brightness: float) -> Dict:
        """Generate brightness recommendation"""
        ref_brightness = self.reference['spectral_centroid']
        diff = your_brightness - ref_brightness
        diff_percent = abs(diff / ref_brightness * 100) if ref_brightness != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Brightness: {your_brightness:.0f} Hz - Excellent tonal match with reference!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Brightness: {your_brightness:.0f} Hz - Very similar to reference ({ref_brightness:.0f} Hz)"
            }
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                suggestion = "Cut highs (8kHz+) or add warmth (200-500Hz)"
            else:
                suggestion = "Boost highs (5-10kHz) or reduce low mids"
            direction = "brighter" if diff > 0 else "darker"
            return {
                'status': 'warning',
                'message': f"Brightness: {your_brightness:.0f} Hz - Your track is {direction}. {suggestion} (reference: {ref_brightness:.0f} Hz)"
            }
        else:
            if diff > 0:
                suggestion = "Heavy high-shelf cut or significant low-mid boost needed"
            else:
                suggestion = "Heavy high-shelf boost or significant low-mid cut needed"
            return {
                'status': 'critical',
                'message': f"Brightness: {your_brightness:.0f} Hz - Major tonal difference! {suggestion} (reference: {ref_brightness:.0f} Hz)"
            }

    def compare_rms(self, your_rms: float) -> Dict:
        """Generate RMS energy recommendation"""
        ref_rms = self.reference['rms']
        diff = your_rms - ref_rms
        diff_percent = abs(diff / ref_rms * 100) if ref_rms != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"RMS Energy: {your_rms:.3f} - Perfect dynamic range match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"RMS Energy: {your_rms:.3f} - Similar dynamics to reference ({ref_rms:.3f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "more compressed" if diff > 0 else "less compressed"
            suggestion = "Back off compression/limiting" if diff > 0 else "Add more compression/limiting"
            return {
                'status': 'warning',
                'message': f"RMS Energy: {your_rms:.3f} - Your track is {direction}. {suggestion} (reference: {ref_rms:.3f})"
            }
        else:
            if diff > 0:
                suggestion = "Your track is heavily over-compressed! Reduce limiting significantly"
            else:
                suggestion = "Your track needs more compression to match reference's density"
            return {
                'status': 'critical',
                'message': f"RMS Energy: {your_rms:.3f} - {suggestion} (reference: {ref_rms:.3f})"
            }

    def compare_key(self, your_key: str) -> Dict:
        """Generate key recommendation"""
        ref_key = self.reference.get('key', 'Unknown')

        if your_key == ref_key:
            return {
                'status': 'perfect',
                'message': f"Key: {your_key} - Perfect key match!"
            }
        else:
            return {
                'status': 'warning',
                'message': f"Key: {your_key} - Different from reference ({ref_key}). Consider transposing or checking if this matters for your genre."
            }

    def compare_spectral_rolloff(self, your_rolloff: float) -> Dict:
        """Generate spectral rolloff recommendation"""
        ref_rolloff = self.reference.get('spectral_rolloff', 0)
        if ref_rolloff == 0:
            return {'status': 'good', 'message': 'Spectral Rolloff: Data not available for comparison'}

        diff = your_rolloff - ref_rolloff
        diff_percent = abs(diff / ref_rolloff * 100)

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Spectral Rolloff: {your_rolloff:.0f} Hz - Excellent frequency balance!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Spectral Rolloff: {your_rolloff:.0f} Hz - Similar to reference ({ref_rolloff:.0f} Hz)"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "more high-frequency content" if diff > 0 else "less high-frequency content"
            suggestion = "Gentle high-shelf cut" if diff > 0 else "Gentle high-shelf boost"
            return {
                'status': 'warning',
                'message': f"Spectral Rolloff: {your_rolloff:.0f} Hz - Your track has {direction}. {suggestion} (reference: {ref_rolloff:.0f} Hz)"
            }
        else:
            direction = "Much brighter" if diff > 0 else "Much darker"
            return {
                'status': 'critical',
                'message': f"Spectral Rolloff: {your_rolloff:.0f} Hz - {direction} than reference ({ref_rolloff:.0f} Hz). Major EQ adjustment needed!"
            }

    def compare_spectral_flatness(self, your_flatness: float) -> Dict:
        """Generate spectral flatness recommendation"""
        ref_flatness = self.reference.get('spectral_flatness', 0)
        if ref_flatness == 0:
            return {'status': 'good', 'message': 'Spectral Flatness: Data not available for comparison'}

        diff = your_flatness - ref_flatness
        diff_percent = abs(diff / ref_flatness * 100)

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Spectral Flatness: {your_flatness:.3f} - Perfect tonality match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Spectral Flatness: {your_flatness:.3f} - Similar character to reference ({ref_flatness:.3f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "more noisy/white-noise character" if diff > 0 else "more tonal/harmonic"
            return {
                'status': 'warning',
                'message': f"Spectral Flatness: {your_flatness:.3f} - Your track is {direction} (reference: {ref_flatness:.3f})"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Spectral Flatness: {your_flatness:.3f} - Very different tonal character from reference ({ref_flatness:.3f})"
            }

    def compare_low_energy(self, your_low: float) -> Dict:
        """Generate low energy recommendation"""
        ref_low = self.reference.get('low_energy', 0)
        if ref_low == 0:
            return {'status': 'good', 'message': 'Low Energy: Data not available for comparison'}

        diff = your_low - ref_low
        abs_diff = abs(diff)

        if abs_diff <= 3:
            return {
                'status': 'perfect',
                'message': f"Low Energy: {your_low:.1f}% - Perfect bass balance!"
            }
        elif abs_diff <= 8:
            return {
                'status': 'good',
                'message': f"Low Energy: {your_low:.1f}% - Similar to reference ({ref_low:.1f}%)"
            }
        elif abs_diff <= 15:
            direction = "more bass" if diff > 0 else "less bass"
            suggestion = "Reduce lows (20-250Hz)" if diff > 0 else "Boost lows (20-250Hz)"
            return {
                'status': 'warning',
                'message': f"Low Energy: {your_low:.1f}% - Your track has {direction}. {suggestion} (reference: {ref_low:.1f}%)"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Low Energy: {your_low:.1f}% - Major bass imbalance! Adjust 20-250Hz range significantly (reference: {ref_low:.1f}%)"
            }

    def compare_mid_energy(self, your_mid: float) -> Dict:
        """Generate mid energy recommendation"""
        ref_mid = self.reference.get('mid_energy', 0)
        if ref_mid == 0:
            return {'status': 'good', 'message': 'Mid Energy: Data not available for comparison'}

        diff = your_mid - ref_mid
        abs_diff = abs(diff)

        if abs_diff <= 3:
            return {
                'status': 'perfect',
                'message': f"Mid Energy: {your_mid:.1f}% - Perfect midrange balance!"
            }
        elif abs_diff <= 8:
            return {
                'status': 'good',
                'message': f"Mid Energy: {your_mid:.1f}% - Similar to reference ({ref_mid:.1f}%)"
            }
        elif abs_diff <= 15:
            direction = "more mids" if diff > 0 else "less mids"
            suggestion = "Cut 250Hz-4kHz" if diff > 0 else "Boost 250Hz-4kHz"
            return {
                'status': 'warning',
                'message': f"Mid Energy: {your_mid:.1f}% - Your track has {direction}. {suggestion} (reference: {ref_mid:.1f}%)"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Mid Energy: {your_mid:.1f}% - Major midrange imbalance! Adjust 250Hz-4kHz range (reference: {ref_mid:.1f}%)"
            }

    def compare_high_energy(self, your_high: float) -> Dict:
        """Generate high energy recommendation"""
        ref_high = self.reference.get('high_energy', 0)
        if ref_high == 0:
            return {'status': 'good', 'message': 'High Energy: Data not available for comparison'}

        diff = your_high - ref_high
        abs_diff = abs(diff)

        if abs_diff <= 3:
            return {
                'status': 'perfect',
                'message': f"High Energy: {your_high:.1f}% - Perfect treble balance!"
            }
        elif abs_diff <= 8:
            return {
                'status': 'good',
                'message': f"High Energy: {your_high:.1f}% - Similar to reference ({ref_high:.1f}%)"
            }
        elif abs_diff <= 15:
            direction = "more highs" if diff > 0 else "less highs"
            suggestion = "Cut 4kHz+" if diff > 0 else "Boost 4kHz+"
            return {
                'status': 'warning',
                'message': f"High Energy: {your_high:.1f}% - Your track has {direction}. {suggestion} (reference: {ref_high:.1f}%)"
            }
        else:
            return {
                'status': 'critical',
                'message': f"High Energy: {your_high:.1f}% - Major treble imbalance! Adjust 4kHz+ range significantly (reference: {ref_high:.1f}%)"
            }

    def compare_sub_bass(self, your_sub: float) -> Dict:
        """Generate sub-bass recommendation"""
        ref_sub = self.reference.get('sub_bass_presence', 0)
        if ref_sub == 0:
            return {'status': 'good', 'message': 'Sub-bass: Data not available for comparison'}

        diff = your_sub - ref_sub
        abs_diff = abs(diff)

        if abs_diff <= 2:
            return {
                'status': 'perfect',
                'message': f"Sub-bass: {your_sub:.1f}% - Perfect sub-bass presence!"
            }
        elif abs_diff <= 5:
            return {
                'status': 'good',
                'message': f"Sub-bass: {your_sub:.1f}% - Similar to reference ({ref_sub:.1f}%)"
            }
        elif abs_diff <= 10:
            direction = "more sub-bass" if diff > 0 else "less sub-bass"
            suggestion = "Reduce 20-60Hz" if diff > 0 else "Boost 20-60Hz"
            return {
                'status': 'warning',
                'message': f"Sub-bass: {your_sub:.1f}% - Your track has {direction}. {suggestion} (reference: {ref_sub:.1f}%)"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Sub-bass: {your_sub:.1f}% - Major sub-bass difference! Adjust 20-60Hz range (reference: {ref_sub:.1f}%)"
            }

    def compare_dynamic_range(self, your_dr: float) -> Dict:
        """Generate dynamic range recommendation"""
        ref_dr = self.reference.get('dynamic_range', 0)
        if ref_dr == 0:
            return {'status': 'good', 'message': 'Dynamic Range: Data not available for comparison'}

        diff = your_dr - ref_dr
        abs_diff = abs(diff)

        if abs_diff <= 1:
            return {
                'status': 'perfect',
                'message': f"Dynamic Range: {your_dr:.1f} dB - Perfect DR match!"
            }
        elif abs_diff <= 2:
            return {
                'status': 'good',
                'message': f"Dynamic Range: {your_dr:.1f} dB - Similar to reference ({ref_dr:.1f} dB)"
            }
        elif abs_diff <= 4:
            direction = "more dynamic" if diff > 0 else "more compressed"
            suggestion = "Increase limiting" if diff > 0 else "Reduce limiting"
            return {
                'status': 'warning',
                'message': f"Dynamic Range: {your_dr:.1f} dB - Your track is {direction}. {suggestion} (reference: {ref_dr:.1f} dB)"
            }
        else:
            direction = "Much more dynamic" if diff > 0 else "Over-compressed"
            return {
                'status': 'critical',
                'message': f"Dynamic Range: {your_dr:.1f} dB - {direction}! Major mastering adjustment needed (reference: {ref_dr:.1f} dB)"
            }

    def compare_danceability(self, your_dance: float) -> Dict:
        """Generate danceability recommendation"""
        ref_dance = self.reference.get('danceability', 0)
        if ref_dance == 0:
            return {'status': 'good', 'message': 'Danceability: Data not available for comparison'}

        diff = your_dance - ref_dance
        diff_percent = abs(diff / ref_dance * 100) if ref_dance != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Danceability: {your_dance:.2f} - Perfect groove match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Danceability: {your_dance:.2f} - Similar to reference ({ref_dance:.2f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "more danceable" if diff > 0 else "less danceable"
            suggestion = "Soften rhythm elements" if diff > 0 else "Enhance rhythm elements, strengthen beats"
            return {
                'status': 'warning',
                'message': f"Danceability: {your_dance:.2f} - Your track is {direction}. {suggestion} (reference: {ref_dance:.2f})"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Danceability: {your_dance:.2f} - Major groove difference from reference ({ref_dance:.2f})"
            }

    def compare_beat_strength(self, your_beat: float) -> Dict:
        """Generate beat strength recommendation"""
        ref_beat = self.reference.get('beat_strength', 0)
        if ref_beat == 0:
            return {'status': 'good', 'message': 'Beat Strength: Data not available for comparison'}

        diff = your_beat - ref_beat
        diff_percent = abs(diff / ref_beat * 100) if ref_beat != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Beat Strength: {your_beat:.2f} - Perfect rhythmic punch!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Beat Strength: {your_beat:.2f} - Similar to reference ({ref_beat:.2f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "stronger beats" if diff > 0 else "weaker beats"
            suggestion = "Reduce transient shaping/compression on drums" if diff > 0 else "Add transient shaping, compress drums"
            return {
                'status': 'warning',
                'message': f"Beat Strength: {your_beat:.2f} - Your track has {direction}. {suggestion} (reference: {ref_beat:.2f})"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Beat Strength: {your_beat:.2f} - Major difference in beat prominence from reference ({ref_beat:.2f})"
            }

    def compare_valence(self, your_valence: float) -> Dict:
        """Generate valence (mood) recommendation"""
        ref_valence = self.reference.get('valence', 0)
        if ref_valence == 0:
            return {'status': 'good', 'message': 'Valence: Data not available for comparison'}

        diff = your_valence - ref_valence
        diff_percent = abs(diff / ref_valence * 100) if ref_valence != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Valence: {your_valence:.2f} - Perfect emotional match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Valence: {your_valence:.2f} - Similar mood to reference ({ref_valence:.2f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "happier/more positive" if diff > 0 else "sadder/darker"
            return {
                'status': 'warning',
                'message': f"Valence: {your_valence:.2f} - Your track sounds {direction} than reference ({ref_valence:.2f})"
            }
        else:
            return {
                'status': 'critical',
                'message': f"Valence: {your_valence:.2f} - Very different emotional character from reference ({ref_valence:.2f})"
            }

    def compare_stereo_width(self, your_width: float) -> Dict:
        """Generate stereo width recommendation"""
        ref_width = self.reference.get('stereo_width', 0)
        if ref_width == 0:
            return {'status': 'good', 'message': 'Stereo Width: Data not available for comparison'}

        diff = your_width - ref_width
        diff_percent = abs(diff / ref_width * 100) if ref_width != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Stereo Width: {your_width:.2f} - Perfect stereo image match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Stereo Width: {your_width:.2f} - Similar to reference ({ref_width:.2f})"
            }
        elif diff_percent <= self.tolerance['warning']:
            direction = "wider" if diff > 0 else "narrower/more mono"
            suggestion = "Reduce stereo widening" if diff > 0 else "Add stereo widening"
            return {
                'status': 'warning',
                'message': f"Stereo Width: {your_width:.2f} - Your track is {direction}. {suggestion} (reference: {ref_width:.2f})"
            }
        else:
            direction = "Much wider" if diff > 0 else "Much more mono"
            return {
                'status': 'critical',
                'message': f"Stereo Width: {your_width:.2f} - {direction} than reference ({ref_width:.2f}). Major stereo adjustment needed!"
            }

    def compare_loudness_range(self, your_lra: float) -> Dict:
        """Generate Loudness Range (LRA) recommendation"""
        ref_lra = self.reference.get('loudness_range', 0)
        if ref_lra == 0:
            return {'status': 'good', 'message': 'Loudness Range: Data not available for comparison'}

        diff = your_lra - ref_lra
        abs_diff = abs(diff)

        if abs_diff <= 1:
            return {
                'status': 'perfect',
                'message': f"Loudness Range: {your_lra:.1f} LU - Perfect dynamic variation for streaming!"
            }
        elif abs_diff <= 2:
            return {
                'status': 'good',
                'message': f"Loudness Range: {your_lra:.1f} LU - Good match to reference ({ref_lra:.1f} LU)"
            }
        elif abs_diff <= 4:
            direction = "more dynamic variation" if diff > 0 else "less dynamic variation"
            suggestion = "Reduce automation/compression" if diff > 0 else "Add more automation/dynamics"
            return {
                'status': 'warning',
                'message': f"Loudness Range: {your_lra:.1f} LU - Your track has {direction}. {suggestion} (reference: {ref_lra:.1f} LU)"
            }
        else:
            if diff > 0:
                return {
                    'status': 'critical',
                    'message': f"Loudness Range: {your_lra:.1f} LU - Too dynamic for playlist! Increase compression/limiting (reference: {ref_lra:.1f} LU)"
                }
            else:
                return {
                    'status': 'critical',
                    'message': f"Loudness Range: {your_lra:.1f} LU - Over-compressed! Restore dynamics, reduce limiting (reference: {ref_lra:.1f} LU)"
                }

    def compare_true_peak(self, your_peak: float) -> Dict:
        """Generate True Peak recommendation"""
        ref_peak = self.reference.get('true_peak', -1.0)

        # Critical for streaming compliance
        if your_peak > -1.0:
            return {
                'status': 'critical',
                'message': f"True Peak: {your_peak:.1f} dBTP - DANGER! Above -1.0 dBTP will clip on Spotify/streaming! Lower limiter ceiling immediately!"
            }
        elif your_peak > -0.5:
            return {
                'status': 'warning',
                'message': f"True Peak: {your_peak:.1f} dBTP - Very hot! Risky for streaming. Recommend -1.0 dBTP or lower for safety."
            }

        diff = abs(your_peak - ref_peak)

        if diff <= 0.5:
            return {
                'status': 'perfect',
                'message': f"True Peak: {your_peak:.1f} dBTP - Perfect match with reference ({ref_peak:.1f} dBTP)"
            }
        elif diff <= 1.5:
            return {
                'status': 'good',
                'message': f"True Peak: {your_peak:.1f} dBTP - Similar to reference ({ref_peak:.1f} dBTP)"
            }
        else:
            direction = "louder" if your_peak > ref_peak else "quieter"
            return {
                'status': 'warning',
                'message': f"True Peak: {your_peak:.1f} dBTP - {direction} than reference ({ref_peak:.1f} dBTP)"
            }

    def compare_crest_factor(self, your_cf: float) -> Dict:
        """Generate Crest Factor recommendation"""
        ref_cf = self.reference.get('crest_factor', 0)
        if ref_cf == 0:
            return {'status': 'good', 'message': 'Crest Factor: Data not available for comparison'}

        diff = your_cf - ref_cf
        abs_diff = abs(diff)

        if abs_diff <= 1:
            return {
                'status': 'perfect',
                'message': f"Crest Factor: {your_cf:.1f} dB - Perfect punch match!"
            }
        elif abs_diff <= 2:
            return {
                'status': 'good',
                'message': f"Crest Factor: {your_cf:.1f} dB - Similar to reference ({ref_cf:.1f} dB)"
            }
        elif abs_diff <= 4:
            direction = "more punchy/dynamic" if diff > 0 else "more compressed/dense"
            suggestion = "Increase limiting ratio" if diff > 0 else "Reduce limiting, allow more peaks"
            return {
                'status': 'warning',
                'message': f"Crest Factor: {your_cf:.1f} dB - Your track is {direction}. {suggestion} (reference: {ref_cf:.1f} dB)"
            }
        else:
            if diff > 0:
                return {
                    'status': 'critical',
                    'message': f"Crest Factor: {your_cf:.1f} dB - Way too punchy/under-limited! Needs more compression (reference: {ref_cf:.1f} dB)"
                }
            else:
                return {
                    'status': 'critical',
                    'message': f"Crest Factor: {your_cf:.1f} dB - Heavily over-compressed! Brick-walled. Reduce limiting drastically (reference: {ref_cf:.1f} dB)"
                }

    def compare_spectral_contrast(self, your_contrast: float) -> Dict:
        """Generate Spectral Contrast recommendation"""
        ref_contrast = self.reference.get('spectral_contrast', 0)
        if ref_contrast == 0:
            return {'status': 'good', 'message': 'Spectral Contrast: Data not available for comparison'}

        diff = your_contrast - ref_contrast
        diff_percent = abs(diff / ref_contrast * 100) if ref_contrast != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {
                'status': 'perfect',
                'message': f"Spectral Contrast: {your_contrast:.1f} dB - Perfect clarity match!"
            }
        elif diff_percent <= self.tolerance['good']:
            return {
                'status': 'good',
                'message': f"Spectral Contrast: {your_contrast:.1f} dB - Similar to reference ({ref_contrast:.1f} dB)"
            }
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {
                    'status': 'warning',
                    'message': f"Spectral Contrast: {your_contrast:.1f} dB - More punchy/clear. Try: soften EQ peaks, add subtle saturation (reference: {ref_contrast:.1f} dB)"
                }
            else:
                return {
                    'status': 'warning',
                    'message': f"Spectral Contrast: {your_contrast:.1f} dB - Less clear/defined. Try: sharpen EQ, multiband compression (reference: {ref_contrast:.1f} dB)"
                }
        else:
            if diff > 0:
                return {
                    'status': 'critical',
                    'message': f"Spectral Contrast: {your_contrast:.1f} dB - Way too harsh/aggressive! Major EQ smoothing needed (reference: {ref_contrast:.1f} dB)"
                }
            else:
                return {
                    'status': 'critical',
                    'message': f"Spectral Contrast: {your_contrast:.1f} dB - Very muddy/flat! Needs significant clarity enhancement (reference: {ref_contrast:.1f} dB)"
                }

    def compare_transient_energy(self, your_trans: float) -> Dict:
        """Generate Transient Energy recommendation"""
        ref_trans = self.reference.get('transient_energy', 0)
        if ref_trans == 0:
            return {'status': 'good', 'message': 'Transient Energy: Data not available for comparison'}

        diff = your_trans - ref_trans
        abs_diff = abs(diff)

        if abs_diff <= 3:
            return {
                'status': 'perfect',
                'message': f"Transient Energy: {your_trans:.1f}% - Perfect attack/sustain balance!"
            }
        elif abs_diff <= 8:
            return {
                'status': 'good',
                'message': f"Transient Energy: {your_trans:.1f}% - Similar to reference ({ref_trans:.1f}%)"
            }
        elif abs_diff <= 15:
            direction = "more percussive/rhythmic" if diff > 0 else "more sustained/smooth"
            suggestion = "Soften transients" if diff > 0 else "Enhance transients with transient shaper"
            return {
                'status': 'warning',
                'message': f"Transient Energy: {your_trans:.1f}% - Your track is {direction}. {suggestion} (reference: {ref_trans:.1f}%)"
            }
        else:
            if diff > 0:
                return {
                    'status': 'critical',
                    'message': f"Transient Energy: {your_trans:.1f}% - Too percussive/clicky! Soften attacks significantly (reference: {ref_trans:.1f}%)"
                }
            else:
                return {
                    'status': 'critical',
                    'message': f"Transient Energy: {your_trans:.1f}% - Too smooth/dull! Needs major transient enhancement (reference: {ref_trans:.1f}%)"
                }

    def compare_harmonic_to_noise(self, your_hnr: float) -> Dict:
        """Generate Harmonic-to-Noise Ratio recommendation"""
        ref_hnr = self.reference.get('harmonic_to_noise_ratio', 0)
        if ref_hnr == 0:
            return {'status': 'good', 'message': 'HNR: Data not available for comparison'}

        diff = your_hnr - ref_hnr
        abs_diff = abs(diff)

        if abs_diff <= 2:
            return {
                'status': 'perfect',
                'message': f"HNR: {your_hnr:.1f} dB - Perfect tonal/noise balance!"
            }
        elif abs_diff <= 4:
            return {
                'status': 'good',
                'message': f"HNR: {your_hnr:.1f} dB - Similar character to reference ({ref_hnr:.1f} dB)"
            }
        elif abs_diff <= 8:
            if diff > 0:
                return {
                    'status': 'warning',
                    'message': f"HNR: {your_hnr:.1f} dB - More tonal/clean. Try: add subtle noise/saturation for character (reference: {ref_hnr:.1f} dB)"
                }
            else:
                return {
                    'status': 'warning',
                    'message': f"HNR: {your_hnr:.1f} dB - More noisy/textured. Try: noise reduction, cleaner recording (reference: {ref_hnr:.1f} dB)"
                }
        else:
            if diff > 0:
                return {
                    'status': 'critical',
                    'message': f"HNR: {your_hnr:.1f} dB - Too clean/sterile! Add texture, saturation, noise (reference: {ref_hnr:.1f} dB)"
                }
            else:
                return {
                    'status': 'critical',
                    'message': f"HNR: {your_hnr:.1f} dB - Very noisy/lo-fi! Major noise reduction needed (reference: {ref_hnr:.1f} dB)"
                }

    def compare_harmonic_complexity(self, your_hc: float) -> Dict:
        """Generate Harmonic Complexity recommendation"""
        ref_hc = self.reference.get('harmonic_complexity', 0)
        if ref_hc == 0:
            return {'status': 'good', 'message': 'Harmonic Complexity: Data not available'}

        diff = your_hc - ref_hc
        diff_percent = abs(diff / ref_hc * 100) if ref_hc != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Harmonic Complexity: {your_hc:.2f} - Perfect harmonic match!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Harmonic Complexity: {your_hc:.2f} - Similar to reference ({ref_hc:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Harmonic Complexity: {your_hc:.2f} - More complex harmonies. Try: simplify chord progressions (reference: {ref_hc:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Harmonic Complexity: {your_hc:.2f} - Simpler harmonies. Try: add passing chords, extensions (reference: {ref_hc:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Harmonic Complexity: {your_hc:.2f} - Way too complex! Major simplification needed (reference: {ref_hc:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Harmonic Complexity: {your_hc:.2f} - Too simple! Add more harmonic interest (reference: {ref_hc:.2f})"}

    def compare_melodic_range(self, your_mr: float) -> Dict:
        """Generate Melodic Range recommendation"""
        ref_mr = self.reference.get('melodic_range', 0)
        if ref_mr == 0:
            return {'status': 'good', 'message': 'Melodic Range: Data not available'}

        diff = your_mr - ref_mr
        abs_diff = abs(diff)

        if abs_diff <= 3:
            return {'status': 'perfect', 'message': f"Melodic Range: {your_mr:.0f} semitones - Perfect melodic span!"}
        elif abs_diff <= 6:
            return {'status': 'good', 'message': f"Melodic Range: {your_mr:.0f} semitones - Similar to reference ({ref_mr:.0f})"}
        elif abs_diff <= 12:
            if diff > 0:
                return {'status': 'warning', 'message': f"Melodic Range: {your_mr:.0f} semitones - Wider/more dramatic. Try: tighter melodic range (reference: {ref_mr:.0f})"}
            else:
                return {'status': 'warning', 'message': f"Melodic Range: {your_mr:.0f} semitones - Narrower/less dynamic. Try: bigger interval jumps (reference: {ref_mr:.0f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Melodic Range: {your_mr:.0f} semitones - Too wide! Melodic simplification needed (reference: {ref_mr:.0f})"}
            else:
                return {'status': 'critical', 'message': f"Melodic Range: {your_mr:.0f} semitones - Too narrow/monotonous! Expand melody (reference: {ref_mr:.0f})"}

    def compare_rhythmic_density(self, your_rd: float) -> Dict:
        """Generate Rhythmic Density recommendation"""
        ref_rd = self.reference.get('rhythmic_density', 0)
        if ref_rd == 0:
            return {'status': 'good', 'message': 'Rhythmic Density: Data not available'}

        diff = your_rd - ref_rd
        diff_percent = abs(diff / ref_rd * 100) if ref_rd != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Perfect rhythmic busyness!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Similar to reference ({ref_rd:.1f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Busier rhythm. Try: remove elements, simplify drums (reference: {ref_rd:.1f})"}
            else:
                return {'status': 'warning', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Sparser rhythm. Try: add hi-hats, percussion (reference: {ref_rd:.1f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Way too busy/cluttered! Major simplification (reference: {ref_rd:.1f})"}
            else:
                return {'status': 'critical', 'message': f"Rhythmic Density: {your_rd:.1f} events/s - Too sparse/empty! Add rhythmic elements (reference: {ref_rd:.1f})"}

    def compare_arrangement_density(self, your_ad: float) -> Dict:
        """Generate Arrangement Density recommendation"""
        ref_ad = self.reference.get('arrangement_density', 0)
        if ref_ad == 0:
            return {'status': 'good', 'message': 'Arrangement Density: Data not available'}

        diff = your_ad - ref_ad
        diff_percent = abs(diff / ref_ad * 100) if ref_ad != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Arrangement Density: {your_ad:.2f} - Perfect build-up dynamics!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Arrangement Density: {your_ad:.2f} - Similar variation to reference ({ref_ad:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Arrangement Density: {your_ad:.2f} - More dynamic changes. Try: smoother transitions (reference: {ref_ad:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Arrangement Density: {your_ad:.2f} - Flatter arrangement. Try: add build-ups, drops (reference: {ref_ad:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Arrangement Density: {your_ad:.2f} - Too dramatic! Smooth out intensity changes (reference: {ref_ad:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Arrangement Density: {your_ad:.2f} - Too static! Add verse/chorus contrast (reference: {ref_ad:.2f})"}

    def compare_repetition_score(self, your_rs: float) -> Dict:
        """Generate Repetition Score recommendation"""
        ref_rs = self.reference.get('repetition_score', 0)
        if ref_rs == 0:
            return {'status': 'good', 'message': 'Repetition Score: Data not available'}

        diff = your_rs - ref_rs
        diff_percent = abs(diff / ref_rs * 100) if ref_rs != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Repetition Score: {your_rs:.2f} - Perfect hook repetition!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Repetition Score: {your_rs:.2f} - Similar to reference ({ref_rs:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Repetition Score: {your_rs:.2f} - More repetitive. Try: add variations to hook (reference: {ref_rs:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Repetition Score: {your_rs:.2f} - Less repetitive. Try: repeat hook more often (reference: {ref_rs:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Repetition Score: {your_rs:.2f} - Too repetitive/boring! Add melodic variations (reference: {ref_rs:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Repetition Score: {your_rs:.2f} - Not catchy enough! Repeat hooks more (reference: {ref_rs:.2f})"}

    def compare_frequency_occupancy(self, your_fo: float) -> Dict:
        """Generate Frequency Occupancy recommendation"""
        ref_fo = self.reference.get('frequency_occupancy', 0)
        if ref_fo == 0:
            return {'status': 'good', 'message': 'Frequency Occupancy: Data not available'}

        diff = your_fo - ref_fo
        diff_percent = abs(diff / ref_fo * 100) if ref_fo != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Perfect frequency center!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Similar to reference ({ref_fo:.0f} Hz)"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Higher frequency focus. Try: add bass elements (reference: {ref_fo:.0f} Hz)"}
            else:
                return {'status': 'warning', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Lower frequency focus. Try: add brightness, transpose up (reference: {ref_fo:.0f} Hz)"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Too bright! Add bass/warmth significantly (reference: {ref_fo:.0f} Hz)"}
            else:
                return {'status': 'critical', 'message': f"Frequency Occupancy: {your_fo:.0f} Hz - Too dark! Major high-frequency boost needed (reference: {ref_fo:.0f} Hz)"}

    def compare_timbral_diversity(self, your_td: float) -> Dict:
        """Generate Timbral Diversity recommendation"""
        ref_td = self.reference.get('timbral_diversity', 0)
        if ref_td == 0:
            return {'status': 'good', 'message': 'Timbral Diversity: Data not available'}

        diff = your_td - ref_td
        diff_percent = abs(diff / ref_td * 100) if ref_td != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Timbral Diversity: {your_td:.2f} - Perfect texture variety!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Timbral Diversity: {your_td:.2f} - Similar to reference ({ref_td:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Timbral Diversity: {your_td:.2f} - More variety. Try: simplify sound palette (reference: {ref_td:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Timbral Diversity: {your_td:.2f} - Less variety. Try: add different instruments/textures (reference: {ref_td:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Timbral Diversity: {your_td:.2f} - Too many sounds! Simplify arrangement drastically (reference: {ref_td:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Timbral Diversity: {your_td:.2f} - Too monotonous! Add significantly more instruments (reference: {ref_td:.2f})"}

    def compare_vocal_instrumental(self, your_vi: float) -> Dict:
        """Generate Vocal/Instrumental Ratio recommendation"""
        ref_vi = self.reference.get('vocal_instrumental_ratio', 0)
        if ref_vi == 0:
            return {'status': 'good', 'message': 'Vocal/Instrumental: Data not available'}

        diff = your_vi - ref_vi
        diff_percent = abs(diff / ref_vi * 100) if ref_vi != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Vocal/Instrumental: {your_vi:.2f} - Perfect vocal balance!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Vocal/Instrumental: {your_vi:.2f} - Similar to reference ({ref_vi:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Vocal/Instrumental: {your_vi:.2f} - More vocal presence. Try: add instrumental sections (reference: {ref_vi:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Vocal/Instrumental: {your_vi:.2f} - More instrumental. Try: add vocal sections, ad-libs (reference: {ref_vi:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Vocal/Instrumental: {your_vi:.2f} - Way too vocal-heavy! Add instrumental bridges (reference: {ref_vi:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Vocal/Instrumental: {your_vi:.2f} - Too instrumental! Needs more vocals (reference: {ref_vi:.2f})"}

    def compare_energy_curve(self, your_ec: float) -> Dict:
        """Generate Energy Curve recommendation"""
        ref_ec = self.reference.get('energy_curve', 0)
        if ref_ec == 0:
            return {'status': 'good', 'message': 'Energy Curve: Data not available'}

        diff = your_ec - ref_ec
        diff_percent = abs(diff / ref_ec * 100) if ref_ec != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Energy Curve: {your_ec:.2f} - Perfect energy flow!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Energy Curve: {your_ec:.2f} - Similar to reference ({ref_ec:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Energy Curve: {your_ec:.2f} - More dynamic energy. Try: flatten chorus/verse contrast (reference: {ref_ec:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Energy Curve: {your_ec:.2f} - Flatter energy. Try: add build-ups, make chorus punchier (reference: {ref_ec:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Energy Curve: {your_ec:.2f} - Too dramatic! Smooth out energy changes (reference: {ref_ec:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Energy Curve: {your_ec:.2f} - Too flat/boring! Add verse/chorus dynamics (reference: {ref_ec:.2f})"}

    def compare_call_response(self, your_cr: float) -> Dict:
        """Generate Call-Response recommendation"""
        ref_cr = self.reference.get('call_response_presence', 0)
        if ref_cr == 0:
            return {'status': 'good', 'message': 'Call-Response: Data not available'}

        diff = your_cr - ref_cr
        diff_percent = abs(diff / ref_cr * 100) if ref_cr != 0 else 0

        if diff_percent <= self.tolerance['perfect']:
            return {'status': 'perfect', 'message': f"Call-Response: {your_cr:.2f} - Perfect musical dialogue!"}
        elif diff_percent <= self.tolerance['good']:
            return {'status': 'good', 'message': f"Call-Response: {your_cr:.2f} - Similar to reference ({ref_cr:.2f})"}
        elif diff_percent <= self.tolerance['warning']:
            if diff > 0:
                return {'status': 'warning', 'message': f"Call-Response: {your_cr:.2f} - More back-and-forth. Try: make phrases more continuous (reference: {ref_cr:.2f})"}
            else:
                return {'status': 'warning', 'message': f"Call-Response: {your_cr:.2f} - Less dialogue. Try: add answering phrases, echos (reference: {ref_cr:.2f})"}
        else:
            if diff > 0:
                return {'status': 'critical', 'message': f"Call-Response: {your_cr:.2f} - Too repetitive! Make phrases more continuous (reference: {ref_cr:.2f})"}
            else:
                return {'status': 'critical', 'message': f"Call-Response: {your_cr:.2f} - No catchiness! Add call-response patterns (reference: {ref_cr:.2f})"}
