import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../auth/patient_auth.dart';
import '../theme.dart';
import 'complete_profile_screen.dart';
import 'my_appointments_screen.dart';

class PatientLoginScreen extends StatefulWidget {
  const PatientLoginScreen({super.key});

  @override
  State<PatientLoginScreen> createState() => _PatientLoginScreenState();
}

class _PatientLoginScreenState extends State<PatientLoginScreen> {
  final _mobile = TextEditingController();
  final _code = TextEditingController();
  bool _codeStep = false;
  bool _busy = false;
  String? _error;
  int _secondsLeft = 0;
  Timer? _timer;

  @override
  void dispose() {
    _mobile.dispose();
    _code.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    setState(() => _secondsLeft = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) t.cancel();
    });
  }

  Future<void> _sendCode() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = PatientAuthScope.of(context);
      final secs = await auth.api.requestOtp(_mobile.text.trim());
      setState(() => _codeStep = true);
      _startCountdown(secs);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = PatientAuthScope.of(context);
      final res = await auth.api.verifyOtp(_mobile.text.trim(), _code.text.trim());
      await auth.setSession(res.accessToken, res.patient);
      if (!mounted) return;
      final needsProfile = res.patient == null || !res.patient!.isComplete;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => needsProfile
            ? const CompleteProfileScreen()
            : const MyAppointmentsScreen(),
      ));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.verified_user_outlined,
                      color: AppColors.primary, size: 30),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _codeStep ? 'Enter the code' : 'Sign in to continue',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                _codeStep
                    ? 'We sent a 6-digit code to ${_mobile.text.trim()}.'
                    : 'We will text a one-time code to your mobile number.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 28),
              if (!_codeStep) ...[
                TextField(
                  controller: _mobile,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    hintText: '9876543210',
                  ),
                ),
              ] else ...[
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, letterSpacing: 8),
                  decoration: const InputDecoration(
                    labelText: '6-digit code',
                    counterText: '',
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _busy ? null : (_codeStep ? _verify : _sendCode),
                  child: Text(_busy
                      ? 'Please wait…'
                      : (_codeStep ? 'Verify & continue' : 'Send code')),
                ),
              ),
              if (_codeStep)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: () => setState(() {
                        _codeStep = false;
                        _code.clear();
                        _error = null;
                      }),
                      child: const Text('Change number'),
                    ),
                    TextButton(
                      onPressed: (_secondsLeft > 0 || _busy) ? null : _sendCode,
                      child: Text(_secondsLeft > 0
                          ? 'Resend in ${_secondsLeft}s'
                          : 'Resend code'),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
