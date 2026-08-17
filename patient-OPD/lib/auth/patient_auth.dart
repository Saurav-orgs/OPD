import 'package:flutter/widgets.dart';
import '../api/api_client.dart';
import '../api/models.dart';

/// Holds the patient session (OTP-issued token) and exposes registration state.
class PatientAuthController extends ChangeNotifier {
  final ApiClient api;
  Patient? patient;
  String? mobile;
  bool loading = true;

  PatientAuthController(this.api);

  bool get isAuthenticated => api.tokens.token != null;
  bool get isProfileComplete => patient?.isComplete ?? false;

  Future<void> bootstrap() async {
    await api.tokens.load();
    if (api.tokens.token == null) {
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final me = await api.me();
      mobile = me.mobile;
      patient = me.patient;
    } catch (_) {
      // Token rejected or expired — drop it rather than retry in a loop.
      await api.tokens.clear();
      patient = null;
      mobile = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> setSession(String token, Patient? p) async {
    await api.tokens.set(token);
    patient = p;
    mobile = p?.mobile ?? mobile;
    loading = false;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (!isAuthenticated) return;
    final me = await api.me();
    mobile = me.mobile;
    patient = me.patient;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.tokens.clear();
    patient = null;
    mobile = null;
    notifyListeners();
  }
}

class PatientAuthScope extends InheritedNotifier<PatientAuthController> {
  const PatientAuthScope({
    super.key,
    required PatientAuthController controller,
    required super.child,
  }) : super(notifier: controller);

  static PatientAuthController of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<PatientAuthScope>();
    assert(scope != null, 'PatientAuthScope not found in context');
    return scope!.notifier!;
  }
}
