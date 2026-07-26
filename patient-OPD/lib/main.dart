import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/doctor_list_screen.dart';

void main() {
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
