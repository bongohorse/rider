> Historical record, superseded for current work by [PLAN.md](../../PLAN.md). Old status, scope and authorization statements are not current instructions.

[Documentation index](../../README.md)

# 10. Gate-Politik und Stop-Regeln

### 10.1 Ergebnisse

- `PASS`: alle **Pflichtnachweise** bestanden und dokumentiert.
- `FAIL`: Pflichtfunktion/Test nachweislich fehlgeschlagen.
- `BLOCKED`: Pflichtprüfung nicht ausführbar, externe Voraussetzung fehlt oder API unbewiesen. **Kein PASS.**
- `DEFERRED`: nur ausdrücklich optionale Funktion zurückgestellt, mit Entscheidung/Grund und akzeptierter Konsequenz.
- `NOT RUN`: nicht ausgeführt; bei Pflichttest als nicht abgenommen werten.

**Gewöhnlicher Implementierungsfehler:** Im freigegebenen Gate beheben und betroffene Prüfungen erneut ausführen; dafür ist keine neue Nutzerentscheidung nötig.

**Struktureller Blocker:** Wenn eine externe Pflichtvoraussetzung fehlt, die gewählte Technologie eine Pflichtfunktion nicht erfüllt oder eine Änderung von Umfang/Architektur nötig wird: abhängige Arbeit stoppen → reproduzierbaren Befund und Auswirkungen vorlegen → sinnvolle Alternativen mit Aufwand/Risiko → Nutzerentscheidung. Unabhängige, bereits autorisierte Arbeit im selben Gate darf abgeschlossen werden. Keine stillen Technologie-Fallbacks, grünen Schein-Checks oder verdeckte Reduktion der Testlast.

Alle Freigaben gelten in ihrem ausdrücklich erteilten Umfang weiter. Nach einem Gate beginnt keine weitere Phase automatisch. Ein technischer PASS ersetzt bei G5 nicht die menschliche Gameplay-Abnahme.

### 10.2 Vier unabhängige Entscheidungen

1. **Technischer Gate-Abschluss:** Tests und dokumentierte Kriterien erfüllt.
2. **Review/Merge-Freigabe:** PR darf in `main`.
3. **Nächstes Gate freigegeben:** Agent darf weitere Phase beginnen.
4. **Deployment-Freigabe:** Vorschau/Release darf aktualisiert werden.

Diese Freigaben nicht miteinander verwechseln oder automatisch aus einem grünen PR ableiten.

### 10.3 Verifizierter Stand

Jeder Bericht enthält:

```text
Gate: Gx
Repository: owner/repo
Branch + HEAD SHA: ...
PR-Nummer + getesteter PR-HEAD-SHA: ...
Merge-Commit SHA: ... / N/A
Deployed Commit/Build-ID: ... / N/A
Testumgebung: Defold/Box2D/Bob/JDK/OS/Gerät
Pflichttests: PASS n / FAIL n / BLOCKED n / NOT RUN n
Optionaltests: PASS n / DEFERRED n / ...
Verifikation: exakte Commands, Logs, CI-Run-URLs, Artefakte
Resultat: PASS | FAIL | BLOCKED
Offene Punkte: ...
Empfehlung: MERGE | NACHBESSERN | STOP
Weitere Phase begonnen: NEIN
```

Test- und Deploy-Aussagen nur für **genau** den genannten Commit. PR-Test nicht ohne erneute Prüfung als Beweis für späteren Merge/Deployment verwenden.

---
