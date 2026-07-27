import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
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
  runApp(const OpdApp());
}

class OpdApp extends StatelessWidget {
  const OpdApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OPD Appointments',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: const DoctorListScreen(),
    );
  }
}
