import 'dart:io' show Platform;

/// API base URL for the OPD backend.
///
/// - iOS simulator & desktop: `localhost` reaches the host machine.
/// - Android emulator: `10.0.2.2` is the host loopback alias.
/// Override at build time with `--dart-define=API_BASE_URL=...`.
class AppConfig {
  static const String _override =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _override;
    final host =
        (!Platform.isIOS && Platform.isAndroid) ? '10.0.2.2' : 'localhost';
    return 'http://$host:3000/api';
  }

  /// Patients may book from today up to +7 days (matches backend).
  static const int bookingWindowDays = 7;

  /// Max screenshot size in MB (matches backend guard).
  static const int maxUploadMb = 5;
}
