[Documentation index](../../README.md)

# 8.3 Sicherheits- und Release-Vertrag

**Bridge-Status:** Die geplante native Automation-Bridge-Integration bleibt ein G2-Pflichtnachweis, unabhängig von der Optionalität eines Community-MCP-Adapters. Bei strukturellem Build-/Kompatibilitätsblocker die bereits funktionierenden CLI-/Runtime-Nachweise sichern und eine Entscheidung über eine gleichwertige Alternative einholen. Ohne akzeptierte Umfangsänderung bleibt G2 BLOCKED/FAIL; die Bridge nicht stillschweigend DEFERRED setzen.

**G2-Capability-Smoke:** Auf mindestens einer vorab benannten unterstützten nativen Debug-Plattform alle folgenden Fähigkeiten praktisch nachweisen und in der Plattformmatrix festhalten:
1. Richtige laufende Engine/Projektinstanz erkennen; native Bridge- und Wrapper-Version sowie erforderliche Capabilities abgleichen.
2. Bekanntes Element oder definierten Runtime-Zustand erfolgreich abfragen.
3. Einen Eingabebefehl senden, Empfang/Ausführung gemäß API bestätigen und die erwartete Zustands- oder sichtbare Verhaltensänderung beobachten. Ein HTTP-Erfolg oder bloßes Receipt allein genügt nicht.
4. Screenshot auf den vereinbarten Grafikplattformen, auf denen die gepinnte Bridge ihn unterstützt, erfassen. Headless-/andere Plattformgrenzen explizit ausweisen; fehlende zugesagte Screenshot-Fähigkeit bleibt BLOCKED/FAIL, kein stilles Weglassen.
5. Den bereits vorgesehenen Release-Negativtest bestehen. Die erfolgreiche native Bridge-Abnahme ersetzt keine HTML5-Browserautomation und keine echte Android-Abnahme.

**Wrapper:** Python-Wrapper aus dem zur gepinnten Extension passenden Stand installieren. Extension und Wrapper gemeinsam aktualisieren, Version/Commit und Herkunft im Lock dokumentieren und reale API-/Capability-Kompatibilität prüfen. Keine unkontrollierte Latest-Aktualisierung. Lizenznachweis aus dem konkreten Repository-/Release-Stand führen; fehlende Asset-Katalog-Metadaten sind weder Lizenzfreigabe noch Beweis eines Lizenzverbots.

- MCP/Editor-/Engine-Service lokal-only. Bei Container/Remote-Entwicklung Zugriff explizit dokumentieren.
- Privilegierte `/eval`-Funktionen nur nach Sicherheitsprüfung freigeben.
- Secrets in `.gitignore`, CI-Ausgaben redigieren.
- Debug-Bridge/Automations-IDs nicht in Release übernehmen, soweit die installierte Bridge dies garantiert; **Release-Negativtest** verifiziert diese Annahme.
- Minimale GitHub-Actions-Permissions; kein Secretzugriff bei untrusted PRs.

---
