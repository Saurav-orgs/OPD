import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/patient_auth.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'complete_profile_screen.dart';
import 'doctor_detail_screen.dart';
import 'my_appointments_screen.dart';
import 'patient_login_screen.dart';

class DoctorListScreen extends StatefulWidget {
  const DoctorListScreen({super.key});

  @override
  State<DoctorListScreen> createState() => _DoctorListScreenState();
}

class _DoctorListScreenState extends State<DoctorListScreen> {
  final _api = ApiClient();
  final _searchCtrl = TextEditingController();

  List<Doctor> _all = [];
  bool _loading = true;
  String? _error;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final doctors = await _api.listDoctors();
      if (!mounted) return;
      setState(() {
        _all = doctors;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load doctors.';
        _loading = false;
      });
    }
  }

  List<Doctor> get _filtered {
    if (_query.trim().isEmpty) return _all;
    final q = _query.toLowerCase();
    return _all.where((d) {
      return d.name.toLowerCase().contains(q) ||
          (d.specialization?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final auth = PatientAuthScope.of(context);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            Expanded(child: _list()),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => auth.isAuthenticated && auth.isProfileComplete
                ? const MyAppointmentsScreen()
                : auth.isAuthenticated
                    ? const CompleteProfileScreen()
                    : const PatientLoginScreen(),
          ),
        ),
        icon: const Icon(Icons.event_note_outlined),
        label: Text(auth.isAuthenticated ? 'My visits' : 'Sign in'),
      ),
    );
  }

  Widget _header() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryHover],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_hospital_rounded, color: Colors.white, size: 22),
              SizedBox(width: 8),
              Text('OPD Appointments',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                      fontSize: 15)),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Find your doctor',
              style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                  fontSize: 24)),
          const SizedBox(height: 4),
          Text('Book an OPD visit in a few taps',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85), fontSize: 14)),
          const SizedBox(height: 16),
          _searchField(),
        ],
      ),
    );
  }

  Widget _searchField() {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadius.control),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (v) => setState(() => _query = v),
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search by name or specialization',
          hintStyle: const TextStyle(color: AppColors.textSecondary),
          prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
          suffixIcon: _query.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () {
                    _searchCtrl.clear();
                    setState(() => _query = '');
                    FocusScope.of(context).unfocus();
                  },
                ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.control),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.control),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.control),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.2),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
        ),
      ),
    );
  }

  Widget _list() {
    if (_loading) return const StateView(loading: true);
    if (_error != null) return StateView(error: _error, onRetry: _load);

    final doctors = _filtered;
    if (_all.isEmpty) {
      return const StateView(empty: 'No doctors are available right now.');
    }
    if (doctors.isEmpty) {
      return StateView(empty: 'No doctors match “$_query”.');
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: doctors.length + 1,
        separatorBuilder: (_, i) => SizedBox(height: i == 0 ? 0 : 12),
        itemBuilder: (_, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _query.isEmpty
                    ? '${doctors.length} ${doctors.length == 1 ? 'doctor' : 'doctors'} available'
                    : '${doctors.length} result${doctors.length == 1 ? '' : 's'}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontWeight: FontWeight.w500),
              ),
            );
          }
          return _DoctorCard(doctor: doctors[i - 1]);
        },
      ),
    );
  }
}

class _DoctorCard extends StatelessWidget {
  final Doctor doctor;
  const _DoctorCard({required this.doctor});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.card),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => DoctorDetailScreen(doctor: doctor)),
        ),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: AppColors.border, width: 0.5),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              NetworkAvatar(
                  url: doctor.profilePhotoUrl, size: 64, fallback: Icons.person),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doctor.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w500, fontSize: 15.5)),
                    if (doctor.specialization != null) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(Icons.medical_services_outlined,
                              size: 14, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(doctor.specialization!,
                                style: const TextStyle(
                                    color: AppColors.textSecondary)),
                          ),
                        ],
                      ),
                    ],
                    if (doctor.qualifications != null) ...[
                      const SizedBox(height: 2),
                      Text(doctor.qualifications!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 12)),
                    ],
                    if (doctor.clinic != null) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.business_outlined,
                              size: 12, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(doctor.clinic!.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (doctor.consultationFee != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.secondaryTint,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(doctor.feeLabel,
                                style: const TextStyle(
                                    color: AppColors.secondary,
                                    fontWeight: FontWeight.w500,
                                    fontSize: 12)),
                          ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.primaryTint,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text('Book',
                              style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
