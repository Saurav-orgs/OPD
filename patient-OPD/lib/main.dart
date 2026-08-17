import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'api/api_client.dart';
import 'auth/patient_auth.dart';
import 'theme.dart';
import 'screens/doctor_list_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Load runtime config (API base URL). Optional so a missing .env falls back
  // to AppConfig's per-platform defaults instead of crashing at startup.
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // No .env bundled — AppConfig will use its built-in defaults.
  }

  final auth = PatientAuthController(ApiClient());
  await auth.bootstrap();

  runApp(OpdApp(auth: auth));
}

class OpdApp extends StatelessWidget {
  final PatientAuthController auth;
  const OpdApp({super.key, required this.auth});

  @override
  Widget build(BuildContext context) {
    return PatientAuthScope(
      controller: auth,
      child: MaterialApp(
        title: 'OPD Appointments',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const DoctorListScreen(),
      ),
    );
  }
}
