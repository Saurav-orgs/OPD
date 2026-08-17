import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../auth/patient_auth.dart';
import '../theme.dart';
import 'my_appointments_screen.dart';

const _genders = [
  ('male', 'Male'),
  ('female', 'Female'),
  ('other', 'Other'),
];

class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _name = TextEditingController();
  final _age = TextEditingController();
  String? _gender;
  bool _busy = false;
  bool _hydrated = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_hydrated) return;
    final p = PatientAuthScope.of(context).patient;
    if (p != null) {
      _name.text = p.name;
      if (p.age != null) _age.text = '${p.age}';
      _gender = p.gender;
    }
    _hydrated = true;
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = PatientAuthScope.of(context);
      await auth.api.updateMe({
        'name': _name.text.trim(),
        'age': int.tryParse(_age.text.trim()),
        'gender': _gender,
      });
      await auth.refresh();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MyAppointmentsScreen()),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool get _valid =>
      _name.text.trim().length >= 2 &&
      int.tryParse(_age.text.trim()) != null &&
      _gender != null;

  @override
  Widget build(BuildContext context) {
    final mobile = PatientAuthScope.of(context).mobile ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your details'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Doctors use this on your prescriptions, so please keep it accurate.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: TextEditingController(text: mobile),
                enabled: false,
                decoration: const InputDecoration(labelText: 'Mobile number'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _name,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  hintText: 'e.g. Asha Verma',
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _age,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Age',
                  hintText: 'e.g. 34',
                ),
              ),
              const SizedBox(height: 18),
              const Text('Gender',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Row(
                children: _genders.map((g) {
                  final selected = _gender == g.$1;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: selected
                          ? ElevatedButton(
                              onPressed: () => setState(() => _gender = g.$1),
                              child: Text(g.$2))
                          : OutlinedButton(
                              onPressed: () => setState(() => _gender = g.$1),
                              child: Text(g.$2)),
                    ),
                  );
                }).toList(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: (_busy || !_valid) ? null : _save,
                  child: Text(_busy ? 'Saving…' : 'Save and continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
