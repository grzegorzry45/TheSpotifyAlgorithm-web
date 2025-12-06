  """
  PlaylistComparator - Wrapper for Comparator class
  Creates playlist profile and compares tracks
  """

  from typing import Dict, List
  import numpy as np
  from .comparator import Comparator


  class PlaylistComparator:
      """Analyze playlist and compare tracks against it"""

      def __init__(self, playlist_tracks: List[Dict]):
          """
          Initialize with list of analyzed tracks

          Args:
              playlist_tracks: List of track features from playlist
          """
          self.playlist_tracks = playlist_tracks
          self.profile = self._create_profile()
          self.comparator = Comparator(self.profile)

      def _create_profile(self) -> Dict:
          """Create statistical profile from playlist tracks"""
          if not self.playlist_tracks:
              return {}

          profile = {}

          # Get all numeric parameters
          params = [
              'bpm', 'energy', 'loudness', 'spectral_centroid', 'rms',
              'zero_crossing_rate', 'dynamic_range', 'spectral_rolloff',
              'spectral_flatness', 'low_energy', 'mid_energy', 'high_energy',
              'danceability', 'beat_strength', 'sub_bass_presence',
              'stereo_width', 'valence', 'key_confidence'
          ]

          for param in params:
              values = []
              for track in self.playlist_tracks:
                  if param in track and track[param] is not None:
                      try:
                          values.append(float(track[param]))
                      except (ValueError, TypeError):
                          continue

              if values:
                  profile[param] = np.mean(values)
                  profile[f'{param}_std'] = np.std(values)

          return profile

      def get_playlist_profile(self) -> Dict:
          """Return the playlist profile"""
          return self.profile

      def compare_track(self, track_features: Dict) -> List[Dict]:
          """
          Compare single track against playlist profile

          Args:
              track_features: Features of track to compare

          Returns:
              List of recommendations
          """
          return self.comparator.compare_track(track_features)

      def generate_recommendations(self, comparison: List[Dict]) -> List[Dict]:
          """
          Generate formatted recommendations

          Args:
              comparison: Comparison results from compare_track

          Returns:
              List of formatted recommendations
          """
          recommendations = []

          for item in comparison:
              rec = {
                  'category': item.get('parameter', 'General'),
                  'suggestion': item.get('message', ''),
                  'status': item.get('status', 'info')
              }
              recommendations.append(rec)

          return recommendations
