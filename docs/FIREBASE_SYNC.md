# Kanji.pro 3.16 — Firebase Sync (bez serwera, trwałe logowanie)

## Konfiguracja Firebase przez właściciela Kanji.pro (wymagana)

**Nie wklejaj kluczy konta usługi ani prywatnych sekretów do repozytorium.** Firebase Web Config to publiczna konfiguracja klienta, a ochronę danych zapewniają Firestore Security Rules.

1. Otwórz https://console.firebase.google.com/ i utwórz nowy projekt (lub włącz Firebase w obecnym projekcie Google Cloud). Na start wybierz darmowy plan **Spark**, bez dodawania karty płatniczej. Dla małej liczby użytkowników Firestore ma darmowe limity, ale nie ma gwarancji dowolnej skali.
2. **Build → Authentication → Sign-in method → Google → Enable**. Skonfiguruj email kontaktowy.
3. **Authentication → Settings → Authorized domains**: dodaj `pyotrowsky.github.io` (bez protokołu i bez /kanjipro). Jeśli używasz innej domeny, dodaj ją także.
4. **Build → Firestore Database → Create database**: wybierz Standard Edition i bezpłatną bazę `(default)`. Zacznij w **Production mode** (odmowa dostępu dla wszystkich), nie w trybie testowym.
5. W zakładce **Firestore → Rules** skopiuj pełną zawartość pliku [firestore.rules](../firestore.rules) i **Publish**. W ten sposób użytkownik widzi i zapisuje jedynie dokumenty własnego konta. Zasady wdrożenia i ich poprawność trzeba sprawdzić przed testami z wieloma użytkownikami.
6. W **Project settings → General → Your apps** kliknij ikonę **Web (</>)**, zarejestruj aplikację i skopiuj cztery pola z `firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `appId`.
7. Uzupełnij `data/firebase-config.json` dokładnie tymi czterema wartościami, zatwierdź commit na GitHubie. **Nie kopiuj application credentials, private key ani client secret**. GitHub Actions publikuje ten plik automatycznie.
8. Po zakończeniu GitHub Actions przeładuj Kanji.pro. W **Ustawienia → Firebase — automatyczna synchronizacja** naciśnij **Zaloguj się kontem Google**. Na każdym urządzeniu użyj **tego samego konta Google**.
9. Od następnego uruchomienia Firebase przywróci sesję z lokalnej pamięci przeglądarki i wykona synchronizację automatycznie przy dostępie do internetu. W trybie prywatnym albo po usunięciu danych przeglądarki ponowne logowanie może być konieczne.

## Aktualizacja do 3.16 — Firebase jako jedyna synchronizacja

Stara integracja Google Drive została usunięta z interfejsu, kodu i plików publikowanych przez Kanji.pro. Dane wcześniej zapisane na Twoim prywatnym Dysku Google **nie są usuwane**. Wersja 3.16 korzysta wyłącznie z Firebase oraz lokalnej pamięci urządzenia; eksport kopii JSON nadal działa. Przed wyczyszczeniem pamięci starego urządzenia upewnij się, że historia na innym urządzeniu została już zsynchronizowana przez Firebase.

## Działanie i ograniczenia

- Firebase Auth używa `browserLocalPersistence` i `onAuthStateChanged`; po ponownym otwarciu tej samej przeglądarki zwykle nie trzeba logować się ponownie.
- Google Sign-In korzysta z okna `signInWithPopup`; Safari i PWA iOS mogą blokować popup lub okazać się niezgodne z danym przepływem logowania. W takim wypadku przetestuj stronę w Safari. Nie używamy `signInWithRedirect` na GitHub Pages, ponieważ wymaga dodatkowej obsługi ograniczeń pamięci między domenami.
- Każda sesja jest przechowywana osobno; pojedyncza sesja może zostać podzielona na kilka fragmentów po ~85 KB. Dane istniejące przed pierwszym połączeniem są zachowywane jako początkowy snapshot, podzielony na fragmenty.
- Ponowne pobranie tego samego zdarzenia nie zwiększa liczby powtórek: każda odpowiedź ma stabilne ID.
- Offline zapis lokalny (IndexedDB / localStorage) działa niezależnie; wysyłka następuje po odzyskaniu sieci, jeżeli użytkownik jest nadal zalogowany.
- Baza nie używa real-time listeners: dane synchronizują się przy logowaniu, zakończeniu sesji oraz przy powrocie do aplikacji (z ograniczeniem częstotliwości).
- Aby uniknąć zastąpienia chmurowej historii starszym JSON-em, ręczny **import zastępujący całą bazę** jest zablokowany po pierwszym podłączeniu Firebase na tym urządzeniu. Eksport kopii nadal działa.
- Na jednym urządzeniu synchronizacja jest przypisana do jednego konta użytkownika. Jeśli zalogujesz się na inne konto, aplikacja nie połączy automatycznie obu historii.
- Wersja 3.15 zapisuje lokalny dziennik w localStorage do 4 MB; potrzebna będzie przyszła archiwizacja bardzo długiej historii.
- Pełną historię już wcześniej współdzieloną poprzez eksport/Drive i import dwóch urządzeń można zduplikować przy migracji w niektórych przypadkach; przed zmianą zrób kopię i porównaj sumy powtórek. Automatyczna deduplikacja dotyczy **nowych zdarzeń z identyfikatorami**.
- Firestore to usługa Google Cloud, nie prywatny folder Google Drive; konto użytkownika i uprawnienia reguł ograniczają dostęp.

Źródła: https://firebase.google.com/docs/auth/web/auth-state-persistence · https://firebase.google.com/docs/auth/web/google-signin · https://firebase.google.com/docs/firestore/security/get-started · https://firebase.google.com/docs/firestore/pricing
