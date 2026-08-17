import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_application_1/api/api_client.dart';
import 'package:flutter_application_1/auth/patient_auth.dart';
import 'package:flutter_application_1/main.dart';

void main() {
  testWidgets('App builds', (WidgetTester tester) async {
    await tester.pumpWidget(OpdApp(auth: PatientAuthController(ApiClient())));
    expect(find.byType(OpdApp), findsOneWidget);
  });
}
