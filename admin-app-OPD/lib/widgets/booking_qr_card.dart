import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';
import 'common.dart';

/// Shareable QR pointing at the doctor's public booking page. Distinct from the
/// payment QR the doctor uploads, which patients scan to pay.
class BookingQrCard extends StatefulWidget {
  const BookingQrCard({super.key});

  @override
  State<BookingQrCard> createState() => _BookingQrCardState();
}

class _BookingQrCardState extends State<BookingQrCard> {
  Future<BookingQr>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= AuthScope.of(context).api.myBookingQr();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<BookingQr>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const SectionCard(
            child: SizedBox(
              height: 120,
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.2)),
            ),
          );
        }
        // A doctor profile is required for this; stay quiet if it isn't there.
        if (snap.hasError || snap.data == null) return const SizedBox.shrink();

        final qr = snap.data!;
        return SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CardTitle('Share your booking link'),
              const SizedBox(height: 4),
              const Text(
                'Patients scan this to open your booking page.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 14),
              Center(child: _qrImage(qr.qrDataUrl)),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.border.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(qr.url,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _shareOnWhatsApp(qr.shareText),
                    icon: const Icon(Icons.share, size: 16),
                    label: const Text('Share on WhatsApp'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: qr.url));
                      if (context.mounted) {
                        showSuccessSnack(context, 'Link copied');
                      }
                    },
                    icon: const Icon(Icons.copy, size: 16),
                    label: const Text('Copy link'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  /// The backend returns the QR as a data: URL, so decode the base64 payload.
  Widget _qrImage(String dataUrl) {
    final comma = dataUrl.indexOf(',');
    if (comma < 0) return const SizedBox.shrink();
    final bytes = base64Decode(dataUrl.substring(comma + 1));
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.memory(bytes, width: 200, height: 200),
    );
  }

  Future<void> _shareOnWhatsApp(String text) async {
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) showErrorSnack(context, 'Could not open WhatsApp.');
    }
  }
}
