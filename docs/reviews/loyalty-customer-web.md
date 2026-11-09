# Parcours client fidélité — revue locale

Préparation du 1er novembre 2026. Les sections initiales conservent la revue historique du lot 3m ; les compléments 3n/3o puis 3q ci-dessous décrivent le contrat courant : droits émis, checkout et cartes Wallet. Cette tranche raccorde le programme, l’adhésion explicite et la progression aux API du lot 3l. Elle reste masquée sous un flag de build faux par défaut. Aucun programme, compte réel, paiement ou Wallet n’est activé.

## Plan visuel avant implémentation

La page appartient au restaurant et utilise ses variables de thème, sans palette concurrente. Base de référence du site : surface #FFFFFF, texte #1A1A1A, texte secondaire #6B7280, séparateurs #E4E5E7, accent #EB5204 ; les valeurs publiées du restaurant remplacent ces références. Typographie héritée des fontes de corps et de titre du thème, avec prise en charge de l’hébreu. Aucun téléchargement de fonte supplémentaire.

Concept : un espace de fidélité lisible, avec le nom du programme et les règles du restaurant. Le solde de progression est une information métier, pas un indicateur décoratif. Pour les petites cartes à visites, les marques visualisent les visites réellement acquises ; pour les points, une barre accompagne les nombres exacts. Le solde négatif reste explicite. Aucun total de récompenses n’est inventé depuis un reste de progression.

```
Retour au restaurant                    Actualiser
Nom du programme du restaurant
[Règles et progression]                  [Conditions et adhésion]
                                         Case non cochée + adhérer
```

Sur mobile, la lecture suit cet ordre en une colonne, avec boutons accessibles et direction RTL. Les textes restent alignés au début de lecture, sous 80 caractères par ligne. La connexion réutilise l’interface Foody existante ; l’adhésion reste un choix séparé. Pas de faux pass Wallet, QR, statistiques, gradient ou animation décorative. Cette proposition répond à une carte de café/restaurant identifiable tout en respectant chaque identité publiée ; elle ne modifie pas la navigation éditoriale du commerçant. L’entrée est accessible à `/r/{restaurant}/account/loyalty` (ou `/account/loyalty` sur son domaine) et depuis son historique de commandes. Ce namespace ne masque pas une page éditoriale existante appelée `loyalty`.

## Frontières mises en œuvre

La session reste dans le cookie HttpOnly existant. Le BFF limite les méthodes et routes fidélité, exige le restaurant explicite et conserve la protection d’origine des mutations. Chaque lecture personnelle et adhésion est liée à l’identité attendue dans un header de cohérence non authentifiant ; le BFF vérifie `/me` avec le même jeton capturé que celui transmis à la requête, pour qu’un changement de cookie ne fasse pas adhérer ou afficher un autre compte. Aucun identifiant fourni par le navigateur ne donne une autorisation.

Le navigateur n’accepte pas les conditions au seul fait de se connecter. Une demande incertaine conserve son intention originale en session par compte/restaurant, avec reprise explicite. Les lectures et réponses tardives restent liées à cette portée. Les previews et iframes n’exécutent aucun appel fidélité. La suspension permet encore la lecture d’un membre existant ; les états absent, fermé, expiré ou inconnus ne deviennent jamais une inscription ou un solde nul fictif.

Les guides et le corpus public restent identiques au pin Landing immuable `8460a012e28bbc4359613f68e4e01b7f15045c57`. La revue exacte `docs/help/reviews/loyalty-customer-web.json` couvre la tranche masquée ; les procédures ci-dessous sont réservées au pilote interne. Aucun article public ne présente la fonctionnalité comme disponible.

## Procédure initiale du lot 3m — FR

Uniquement dans un environnement de développement isolé et avec des données synthétiques : préparer la version compatible de l’API et ses migrations, puis activer `LOYALTY_PROGRAM_API_ENABLED` côté API et compiler Web avec `NEXT_PUBLIC_LOYALTY_WEB_ENABLED=true`. Les valeurs livrées restent fausses ; cette procédure ne donne aucune autorisation de déploiement ou d’activation réelle. Un responsable autorisé configure et active explicitement le programme dans l’Admin compatible, avec les trois noms/conditions relus.

Ouvrir `/r/{restaurant}/account/loyalty`, ou `/account/loyalty` sur son domaine. Lire les conditions et règles ; se connecter avec l’interface habituelle ne crée pas d’adhésion. Vérifier le bon restaurant, cocher l’acceptation puis choisir « Adhérer à ce programme ». Cette acceptation ne couvre pas le marketing. Le solde est la progression courante, éventuellement négative ; il ne compte pas les récompenses déjà attribuées. Le produit offert est décrit génériquement, car le contrat ne fournit pas encore son libellé public.

Si la réponse manque, actualiser d’abord : une adhésion déjà créée apparaît sans répéter le POST. Sinon, « Reprendre l’adhésion » renvoie uniquement la demande initiale conservée dans cet onglet. Un refus définitif demande de revoir l’offre et de cocher à nouveau ; un échec de lecture ou de stockage bloque la poursuite. Un changement de compte impose une nouvelle vérification ; aucune intention d’un autre compte/restaurant n’est reprise. Une adhésion fermée reste fermée, un programme suspendu reste consultable par ses membres. Les liens de l’historique sont conditionnels et les previews n’appellent pas la fidélité.

La sélection/utilisation des récompenses, les cartes Apple/Google Wallet, le scan et les notifications restent hors de cette tranche. Avant une ouverture réelle, compléter ces parcours, l’acceptation sur appareils, l’intégration au `develop` courant et la publication coordonnée de l’aide FR/HE/EN.

## Initial lot 3m procedure — EN

Use isolated development and synthetic data only. Prepare the compatible API and migrations, enable API `LOYALTY_PROGRAM_API_ENABLED`, then compile Web with `NEXT_PUBLIC_LOYALTY_WEB_ENABLED=true`. Shipped values remain false; these instructions do not authorize deployment or live activation. An authorized manager explicitly configures/enables the program in compatible Admin after reviewing all three translated names/terms.

Open `/r/{restaurant}/account/loyalty`, or `/account/loyalty` on its domain. Read the rules and terms; ordinary sign-in does not enroll the customer. Check the restaurant, tick acceptance, then select “Join this program”. This consent does not include marketing. The balance is current progress and can be negative; it excludes rewards already issued. A free item has generic wording until the API provides its public label.

After an unknown response, refresh first: an existing membership appears without another POST. Otherwise “Resume enrollment” sends only the original request saved in this tab. A definitive rejection requires reviewing the new offer and ticking acceptance again. Read/storage failure blocks continuation. Changing account requires fresh verification and never adopts another account’s or restaurant’s intent. Closed membership cannot reopen; paused programs remain readable to members. History links are conditional and previews make no loyalty requests.

Reward selection/redemption, Apple/Google Wallet cards, scanning and notifications are outside this slice. Real availability requires those flows, device acceptance, integration with current `develop` and coordinated FR/HE/EN help publication.

## נוהל התחלתי לשלב 3m — HE

יש להשתמש בסביבת פיתוח מבודדת ובנתונים סינתטיים בלבד. מכינים API תואם ואת המיגרציות, מפעילים ב-API את `LOYALTY_PROGRAM_API_ENABLED` ומקמפלים את Web עם `NEXT_PUBLIC_LOYALTY_WEB_ENABLED=true`. ברירות המחדל שנמסרות נשארות כבויות; ההוראות אינן הרשאה לפריסה או להפעלה אמיתית. מנהל מורשה מגדיר ומפעיל במפורש את התוכנית ב-Admin תואם, לאחר בדיקת השמות והתנאים בשלוש השפות.

פותחים `/r/{restaurant}/account/loyalty`, או `/account/loyalty` בדומיין המסעדה. קוראים את הכללים והתנאים. התחברות רגילה אינה יוצרת חברות. בודקים את המסעדה, מסמנים אישור ולוחצים על ״הצטרפות לתוכנית״. האישור אינו כולל הסכמה לשיווק. היתרה מייצגת התקדמות נוכחית ויכולה להיות שלילית; היא אינה כוללת הטבות שכבר הונפקו. המוצר המוצע במתנה מתואר באופן כללי עד שה-API יספק שם פומבי.

אם התשובה אינה ידועה, מרעננים תחילה: חברות שכבר נוצרה מוצגת ללא POST נוסף. אחרת, ״המשך ההצטרפות״ שולח רק את הבקשה המקורית שנשמרה בלשונית. סירוב ודאי מחייב בדיקת ההצעה וסימון אישור מחדש. כשל בקריאה או בשמירה חוסם המשך. החלפת חשבון מחייבת אימות חדש ואינה מאמצת בקשה של חשבון או מסעדה אחרים. חברות סגורה אינה נפתחת מחדש; חברים קיימים יכולים לצפות בתוכנית מושהית. הקישורים מההיסטוריה מוצגים לפי זמינות ובתצוגה מקדימה אין קריאות נאמנות.

בחירת הטבות ומימושן, כרטיסי Apple/Google Wallet, סריקה והתראות אינם כלולים בשלב זה. זמינות אמיתית דורשת את השלמת המסלולים, בדיקה במכשירים, שילוב ב-`develop` העדכני ופרסום עזרה מתואם בצרפתית, עברית ואנגלית.


## Revue visuelle initiale du lot 3m

Captures locales dans `../previews/customer-loyalty-desktop.png`, `customer-loyalty-member.png` et `customer-loyalty-hebrew-mobile.png`. Le membre français est vérifié sur un écran de 1 280 pixels, l’adhésion hébraïque sur 390 × 844 pixels. Les données sont synthétiques. Les requêtes navigateur extérieures aux hôtes locaux sont bloquées pendant les essais.

La lecture à deux colonnes conserve le solde exact près des règles et place les conditions/consentements dans un panneau distinct. Sur mobile, la colonne unique et le RTL gardent les conditions avant la case et l’action ; aucun débordement horizontal n’est constaté. Les actions utilisent les tailles et focus du système de commerce existant. Deux corrections ont suivi la première capture : supprimer les surcharges de police qui perdaient la fonte de secours sans réseau, puis remplacer la barre native verte par une barre accessible reprenant l’accent du restaurant. Le thème sombre de la seconde enseigne, les libellés anglais, les conditions littérales et la remise en devise mineure sont contrôlés. Aucun avantage disponible ni pass Wallet fictif n’est dessiné.

La validation locale n’inclut pas les polices distantes, un appareil réel, une émission Wallet, une caisse ou un fournisseur. Le compteur de progression n’est pas une liste de récompenses ; le libellé public du produit offert reste à ajouter au contrat avant une présentation détaillée de cette récompense.

## Validation locale du lot 3m

Le rapport `../lot3m-validation.json` conserve les commandes, journaux et gels : 619 tests purs Web, 16 scénarios navigateur actifs et un scénario désactivé, lint, TypeScript et build Web ; 30 tests de contrat ; check:help, 47 tests, lint, TypeScript et build Landing. Les scénarios utilisent le vrai BFF Next et une API locale synthétique. L’exécution locale Node 25 utilise `--no-experimental-require-module` pour le chargeur Tailwind existant ; les avertissements de lint restants concernent des fichiers inchangés. Le serveur et l’Admin gardent exactement leurs sources du lot 3l validé.

L’inventaire local couvre 352 sources Web et la revue exacte 12 fichiers, sans modifier les cinq autres services ni les guides/corpus publics. Le pin existant reste immuable ; ces nouvelles preuves sont non commitées et doivent recevoir leur checkpoint final lors d’une future intégration autorisée. La page et le BFF demeurent désactivés par défaut. Pas de commit, push, PR, déploiement, compte réel ou appel Wallet.

## Plan visuel complémentaire — récompenses (lot 3n, avant code UI)

Conserver les jetons et typographies du restaurant déjà utilisés ci-dessus. Le nouveau bloc est placé après programme/conditions : une liste séparée par des traits fins, avec le nom de l’avantage, son état textuel et sa date d’expiration. Le produit offert montre son nom et sa variante de catalogue actuels ; les valeurs financières restent celles du droit émis. Aucun nombre de droits n’est déduit du solde. Pagination explicite « Voir la suite », état d’erreur distinct d’une liste vide, et commande d’actualisation accessible. Alignement au début de lecture, une colonne mobile RTL, mêmes cibles de 44 pixels.

```
Vos récompenses                         Actualiser
Remise de 15 ₪                 Disponible
Expiration le …
────────────────────────────────────────
Café · Grand                   Réservée
En attente du résultat du paiement
[Voir la suite]
```

La liste ne réplique pas la carte de progression : elle présente chaque droit réel et ses conditions figées. Les séparateurs distinguent les droits sans ajouter de cartes décoratives. Une réservation reste bloquée, l’expiration est calculée à l’heure du serveur et la lecture ne modifie aucun droit. Une modification de révision entre deux pages demande une nouvelle lecture au lieu d’assembler une projection incohérente.

## Plan avant UI — sélection au checkout et reprise (lot 3o)

Le checkout conserve sa grille et son résumé. Un bloc « Utiliser une récompense » présente des choix radio explicites : aucune par défaut, puis les seuls droits applicables au panier standard et au moyen de règlement. Le résumé montre la remise et le montant estimé restant ; le serveur recalcule tous les montants. Pas de pass fictif, de nouvelle palette ni de formulaire de carte bancaire. Les droits incompatibles avec le panier restent expliqués et ne changent pas le paiement silencieusement.

Une création incertaine laisse un panneau de reprise avec « Vérifier la commande » et « Abandonner cette demande ». La vérification ne crée ni commande ni paiement. L’abandon d’une demande non créée pose un tombstone serveur ; si la création a gagné, le panneau dirige vers sa confirmation et n’annule pas l’encaissement. Le journal d’onglet ne conserve que compte/restaurant, choix de droit, UUID et empreintes SHA-256 ; aucune coordonnée, preuve d’adresse, reçu ou donnée de carte en clair. Une ancienne demande ne peut pas être remplacée par un panier ou un compte différent. FR/HE/EN, thème, focus clavier et RTL reprennent les règles ci-dessus.


## Contrat courant et pilote complémentaire — FR (lots 3n/3o)

Les droits émis sont maintenant affichés sur la page de fidélité, avec leur propre état et date, même si le reste de progression vaut zéro. Le nom et la variante du produit viennent du catalogue du restaurant ; le montant et les conditions proviennent du droit figé. « Réservée » reste bloqué pendant un paiement incertain. « Voir la suite » charge explicitement les pages ; une révision incohérente demande d'actualiser. Une erreur ne devient pas une liste vide.

Pour les essais synthétiques de sélection, activer aussi `LOYALTY_CUSTOMER_CHECKOUT_API_ENABLED` côté API et compiler avec `NEXT_PUBLIC_LOYALTY_CHECKOUT_ENABLED=true`. Les quatre flags programme/Web/checkout API/checkout Web restent faux dans les exemples livrés. Ce complément n'autorise aucune activation ou opération réelle. Dans un panier standard indépendant de retrait/livraison, connecté au même compte, choisir explicitement une récompense applicable ou « Sans récompense ». Le choix par défaut est sans récompense. Le résumé estime la remise ; l'API recalcule le prix et refuse une assertion périmée. Une modification de panier, de moyen ou de compte demande une nouvelle vérification du choix. Le produit offert couvre une unité de base, pas les suppléments ni la livraison. Les combos, poids, tables, espèces, cartes enregistrées et enregistrement de carte ne font pas partie de ce pilote.

Un total entièrement couvert confirme sans débit bancaire ni nouveau gain. Si la création manque de réponse, conserver l'onglet et utiliser « Vérifier la commande » : cette lecture ne crée ni commande ni paiement. Si aucune commande n'a été créée, « Abandonner cette demande » bloque aussi un ancien POST retardé ; si la création a déjà gagné, aller à sa confirmation. Cette action ne clôture pas un paiement déjà créé. Un échec de stockage bloque l'envoi. Le journal d'onglet contient les identifiants et empreintes, sans coordonnées, preuve d'adresse, reçu ni URL bancaire en clair.

Sur la confirmation, « Continuer sur la page de paiement » ne paraît que si l'API retrouve la page HTTPS déjà enregistrée. Une nouvelle vérification de la session précède la navigation. Aucune page n'est initialisée par la reprise ; une issue inconnue reste à vérifier. Un changement de compte ne récupère pas le droit, la commande ou la page bancaire du précédent. Les previews et iframes restent sans appel fidélité. Aucun Wallet ni scanner n'est encore émis par cette tranche.

## Current contract and pilot supplement — EN (lots 3n/3o)

The loyalty page now lists actual issued rewards with their state and date, including when remaining progress is zero. Item/variant labels come from the restaurant catalogue; value and terms come from the frozen right. Reserved rewards remain held during uncertain payment. Load further pages explicitly; revision changes require refresh. A failed read is never an empty list.

For synthetic selection tests, also enable API `LOYALTY_CUSTOMER_CHECKOUT_API_ENABLED` and build with `NEXT_PUBLIC_LOYALTY_CHECKOUT_ENABLED=true`. The four program/Web/checkout API/checkout Web example flags remain false. This does not authorize live activation or operations. In an independent standard pickup/delivery basket, signed into the same account, explicitly choose an applicable reward or “No reward”. No reward is the default. The summary estimates the discount; the API reprices and rejects stale assertions. Basket, payment method or account changes require reviewing the choice. A free item covers one base unit, excluding extras and delivery. Combos, weight pricing, tables, cash, saved cards and card saving are outside this pilot.

A fully covered total confirms without a bank charge or new earnings. After an unknown creation response, keep the tab and use “Check order”: this read creates neither an order nor a payment. If no order exists, “Abandon this request” durably blocks a delayed original POST; if creation won, continue to its confirmation. This does not close an existing payment. Storage failure blocks submission. The tab journal stores identifiers and fingerprints, without plaintext contact, address proof, receipt or bank URL.

On confirmation, “Continue to payment page” appears only when the API finds the existing persisted HTTPS page. Session ownership is verified again before navigation. Recovery never initializes a new page; an unknown outcome remains pending review. Changing account cannot retrieve the previous account's reward, order or bank page. Previews and iframes make no loyalty requests. This slice does not issue Wallet cards or enable scanning.

## חוזה נוכחי והשלמת נוהל הפיילוט — HE (שלבים 3n/3o)

עמוד הנאמנות מציג כעת את ההטבות שהונפקו בפועל, עם המצב והתאריך של כל הטבה, גם כאשר יתרת ההתקדמות היא אפס. שמות המוצר והגרסה מגיעים מקטלוג המסעדה; הערך והתנאים הם של הזכות שנשמרה. הטבה שמורה נשארת חסומה כל עוד תוצאת התשלום אינה ודאית. טוענים דפים נוספים במפורש; שינוי גרסה מחייב רענון. כשל בקריאה אינו מוצג כרשימה ריקה.

לבדיקות סינתטיות של בחירה מפעילים גם ב-API את `LOYALTY_CUSTOMER_CHECKOUT_API_ENABLED` ובבניית Web את `NEXT_PUBLIC_LOYALTY_CHECKOUT_ENABLED=true`. ארבעת דגלי הדוגמה של התוכנית, Web ושני דגלי התשלום נשארים כבויים. ההוראות אינן הרשאה להפעלה או לפעולה אמיתית. בסל רגיל ועצמאי לאיסוף או למשלוח, לאחר התחברות לאותו חשבון, בוחרים במפורש הטבה מתאימה או ״ללא הטבה״. ברירת המחדל היא ללא הטבה. הסיכום מעריך את ההנחה; ה-API מחשב מחדש ודוחה סכום מיושן. שינוי סל, אמצעי תשלום או חשבון מחייב בדיקה מחדש של הבחירה. מוצר במתנה מכסה יחידת בסיס אחת, ללא תוספות ומשלוח. קומבואים, תמחור לפי משקל, שולחנות, מזומן, כרטיס שמור ושמירת כרטיס אינם כלולים בפיילוט.

סכום שמכוסה במלואו מאושר ללא חיוב בנקאי וללא צבירה חדשה. כשאין תשובה ודאית ליצירת הזמנה, משאירים את הלשונית ובוחרים ״בדיקת ההזמנה״: הקריאה אינה יוצרת הזמנה או תשלום. אם ההזמנה לא נוצרה, ״ביטול הבקשה״ חוסם באופן מתמשך גם POST מקורי שהתעכב; אם היצירה כבר הושלמה, ממשיכים לאישור שלה. הפעולה אינה סוגרת תשלום שכבר נוצר. כשל בשמירה חוסם שליחה. יומן הלשונית שומר מזהים וטביעות בלבד, ללא פרטי קשר, הוכחת כתובת, קבלה או כתובת דף בנק בטקסט גלוי.

באישור ההזמנה, ״המשך לדף התשלום״ מוצג רק אם ה-API מוצא את דף ה-HTTPS שכבר נשמר. הבעלות על ההפעלה נבדקת שוב לפני המעבר. חידוש אינו יוצר דף תשלום חדש; תוצאה לא ידועה נשארת לבירור. החלפת חשבון אינה נותנת גישה להטבה, להזמנה או לדף הבנק של החשבון הקודם. תצוגות מקדימות ו-iframe אינן מבצעות קריאות נאמנות. שלב זה אינו מנפיק כרטיסי Wallet ואינו מפעיל סריקה.


## Critique et vérification visuelle des lots 3n/3o

Captures synthétiques relues : `previews/customer-loyalty-rewards.png`, `customer-loyalty-rewards-hebrew.png`, `customer-loyalty-checkout.png` et `customer-loyalty-checkout-hebrew.png` dans le dossier parent. La liste distingue clairement un reste nul et six droits de plusieurs états, sans déduire une quantité depuis les visites. Les séparateurs et libellés portent la hiérarchie ; l'actualisation discrète ne rivalise pas avec l'action principale. Les noms produit/variante restent lisibles. Le checkout hébreu à 390 × 844 garde alignement, montants, case sélectionnée, résumé et action sans débordement horizontal.

Corrections après inspection : radios à la couleur du restaurant avec focus visible, actualisation en lien accessible et menu de langue ouvert sous son déclencheur en tête de checkout. Le choix reste explicite et le montant de 24 ₪ moins 15 ₪ donne bien 9 ₪ estimés. La fixture utilise une politique espèces désactivée pour cette sélection carte ; elle ne masque pas un échec métier réel. Les fontes distantes restent bloquées pendant ces essais. La confirmation/reprise est vérifiée par un scénario avec la vraie route Next, en plus des captures. Aucune installation Wallet ou manipulation d'appareil réel n'est prétendue.

La suite étendue historique `playwright.customer.config.ts` a été interrompue après deux échecs de ses variantes d'inscription/livraison. Le premier scénario Sumit/email a été reproduit seul sur un checkout jetable propre du commit de départ `9ec904c93422e00de9f4e4909a1cd138f9173943` : même attente du combobox à `tests/visual/commerce.spec.ts:245`, formulaire de livraison non ouvert. Les journaux et captures de cette reproduction restent dans le dossier de preuves. Ce checkout jetable a ensuite été retiré ; aucun changement de produit ou de test historique n'a été fait pour contourner cet échec. La validation obligatoire et les scénarios fidélité sont rapportés séparément dans `lot3no-validation.json` ; cette suite élargie ne doit pas être présentée comme entièrement verte.


Deux autres assertions anciennes de cette suite étendue contredisent les composants de départ inchangés : `commerce.spec.ts:782` attend un paiement d'inscription de 1,00 alors que `hostedSignupConsentHelp` décrit déjà l'absence de paiement séparé ; `commerce.spec.ts:1843` attend zéro champ de mot de passe alors que la connexion email/mot de passe est déjà le contrat courant. Le composant de carte et cette valeur de traduction sont byte-identiques à la base ; les scénarios de connexion récents du même fichier attendent bien le mot de passe. Ces assertions n'ont pas été modifiées dans ce chantier. Les journaux des trois explorations élargies sont conservés séparément et ne constituent pas une validation passée.


## Validation finale des lots 3n/3o

Le rapport `../lot3no-validation.json` conserve les gels et commandes : 625 tests purs Web, 26 scénarios fidélité actifs, trois scénarios module désactivé et un checkout indépendamment désactivé, ainsi que six scénarios existants d'inscription/validation téléphonique et commande ordinaire sur build avec flags faux. Lint (avertissements inchangés), TypeScript et builds avec flags vrais/faux passent. Les deux contrats affectés passent leurs 30 tests ; chaque snapshot Landing passe check:help, 47 tests, lint, TypeScript et build. Le serveur passe format, build, vet et les 76 packages avec race sur base locale dédiée et packages sérialisés ; 17 autres packages n'ont pas de tests.

L'inventaire final contient 620 sources API et 356 sources Web ; les revues exactes couvrent respectivement 78 et 18 fichiers. Les 349 fichiers de guides/catalogue de chaque snapshot sont byte-identiques au pin correspondant, ainsi que les cinq autres blocs/surfaces. Les nouvelles preuves ne sont pas commitées et n'établissent pas une disponibilité produit. L'Admin conserve son gel du lot 3l. La suite navigateur historique élargie conserve les limitations précises ci-dessus ; elle n'est pas présentée comme passée. Aucun commit, push, PR, déploiement, vraie notification ou émission Wallet n'a été effectué.


## Plan avant UI — ajout et gestion Wallet (lot 3q)

L'ajout est placé après programme/progression et avant la liste des droits, avec le titre « Votre carte dans Wallet », une courte explication et les seuls boutons des fournisseurs annoncés disponibles. Aucun faux aperçu de pass ni compteur d'installation. Les badges officiels restent noirs, non recolorés et localisés ; ils sont posés sur une petite surface blanche si le thème est sombre. Le reste reprend fond/surface/texte/diviseur/accent du restaurant : références #FFFFFF, #1A1A1A, #6B7280, #E4E5E7, #EB5204, fontes et échelle existantes. La disposition aligne le texte au début de lecture, garde une colonne à 390 pixels/RTL et des cibles d'au moins 44 pixels. Pas d'animation décorative.

```
Votre carte dans Wallet                 Actualiser
Retrouvez votre progression et le site du restaurant.
[Badge Apple Wallet]     [Badge Google Wallet]
Une carte préparée n'est pas une installation confirmée.
Apple Wallet · Carte préparée           Désactiver
```

Révision du plan : les deux boutons ne sont pas dessinés comme des cartes de fidélité ; le programme appartient au restaurant et les plateformes conservent leurs repères officiels. Un fournisseur indisponible n'a pas de bouton simulé. Une carte déjà émise peut être désactivée explicitement même si son fournisseur est temporairement coupé, avec une confirmation qui explique la conservation des points/récompenses. L'erreur de lecture reste distincte de l'absence de fournisseur. Après ajout, aucun message ne prétend que le téléphone a installé la carte.

Apple utilise une navigation de formulaire vers le BFF, qui retourne le fichier signé sans le parser ni le stocker dans le code UI. Google utilise un appel propre au compte, puis une nouvelle vérification personnelle avant navigation vers le lien Google autorisé. Les réponses tardives d'un ancien compte ne déclenchent ni navigation ni confirmation dans le nouveau compte. Les previews/iframes et le nouveau flag faux par défaut restent sans appel Wallet. Les procédures et essais FR/HE/EN seront complétés après vérification de ces parcours.


Révision des éléments de marque avant code UI : le téléchargement du badge Apple présente une acceptation séparée du compte développeur. Aucun accord n'a été accepté au nom de Foody et aucun de ces fichiers n'a été téléchargé. L'action Apple sera donc un bouton textuel du restaurant, sans logo ni imitation de badge ; le fichier signé et le parcours d'ajout restent fonctionnels. Google utilise ses SVG localisés distribués publiquement, copiés sans transformation. Les deux actions gardent une cible de 56 pixels et un espace libre suffisant ; le bouton Google conserve sa couleur, sa forme et ses proportions officielles.

## Lot 3q — ajout et désactivation des cartes Wallet

Le client Web raccorde désormais le contrat serveur du lot 3p. Le nouveau flag `NEXT_PUBLIC_LOYALTY_WALLET_ENABLED=false` est indépendant du programme et du checkout ; l'espace membre doit aussi être activé. Les capacités Apple et Google viennent du serveur pour l'adhésion affichée. Une lecture ne prépare aucune carte et aucun clic ne vaut preuve d'installation. Les éléments natifs Apple/Google, la signature, la publication et les reprises restent sous la responsabilité des adaptateurs Go déjà validés.

Le BFF JSON expose seulement lecture personnelle, préparation Google et révocation vide explicite. Le téléchargement Apple dispose d'un formulaire natif distinct, lié au compte attendu et au restaurant, avec retour limité aux deux routes fidélité connues, nom de fichier fixe, transport ZIP/MIME borné, `no-store` et `no-referrer`. Le protocole Apple d'appareil n'entre jamais dans le gateway client. Le cookie est capturé une seule fois pour `/me` et l'action ; les identifiants affichés ne sont que des assertions, jamais une authentification. Un cookie changé avant la demande est refusé. Google exige encore une lecture propre au compte après préparation, avant navigation. Une demande Apple déjà autorisée peut finir son téléchargement après un changement de session dans un autre onglet ; le fichier appartient au compte qui a autorisé cette demande et ne crée aucune opération sur le nouveau compte.

La carte déjà préparée reste désactivable quand l'émission du fournisseur est coupée ou l'adhésion fermée. La confirmation conserve les points et droits ; Annuler rend le focus au déclencheur. Un résultat perdu ne déclenche pas de second POST automatique : une relecture constate la carte absente et retire la confirmation devenue obsolète. Une erreur de lecture et une portée incohérente masquent les actions sans inventer une liste vide.

### Pilote interne — français

1. Préparer un restaurant et un membre synthétiques ; garder les trois flags Web et les flags serveur/fournisseur désactivés hors du pilote explicitement préparé. Aucun secret Wallet ne va dans le Web. Le compte émetteur Google et les certificats Apple valides sont des prérequis à l'essai physique.
2. Ouvrir l'espace fidélité du bon restaurant et se connecter au compte membre. Seules les plateformes annoncées disponibles ont une action ; aucune carte n'est créée à l'affichage de la page.
3. Sur un appareil Apple compatible, « Ajouter la carte à Apple Wallet » envoie le formulaire et reçoit l'archive signée. Sur Google, « Ajouter à Google Wallet » prépare la carte puis ouvre l'écran Google après vérification du compte. Terminer et contrôler l'installation sur téléphone reste une acceptation physique distincte.
4. « Actualiser » relit l'adhésion et les cartes. « Carte préparée » et « Mise à jour en attente » décrivent le serveur ; ces libellés ne certifient pas l'installation.
5. « Désactiver cette carte » ouvre une confirmation. « Annuler » ne modifie rien. Confirmer invalide cette carte, en conservant adhésion, solde et récompenses. L'écran ne promet pas une nouvelle émission quand l'adhésion ou le fournisseur n'est plus disponible.
6. Après une erreur ou une réponse perdue, actualiser avant une nouvelle action. Une session changée impose de vérifier son compte. Aucun message technique du fournisseur n'est affiché. Les previews et iframes restent sans appels Wallet.

### Internal pilot — English

1. Use a synthetic restaurant and member. Web, API and provider flags remain off outside the explicitly prepared pilot. Wallet secrets belong only on the server. Valid Apple certificates and the Google issuer account are prerequisites for device acceptance.
2. Open that restaurant's loyalty account and sign in. Only providers reported available have an action. Page views never create cards.
3. On a compatible Apple device, “Add your card to Apple Wallet” submits the native form and receives the signed archive. “Add to Google Wallet” prepares the card, rechecks the account and opens Google's screen. Completing installation must still be verified on a physical device.
4. Refresh reads membership and cards. “Card prepared” and “Update pending” describe server state, not confirmed installation.
5. Deactivate opens an explicit confirmation; Cancel restores focus and makes no request. Confirming invalidates that card while retaining membership, balance and rewards. A new card is not promised for an unavailable provider or membership.
6. After a lost response, refresh before acting again. A changed session requires checking the account. Raw provider details never appear. Previews and frames make no Wallet requests.

### פיילוט פנימי — עברית

1. משתמשים במסעדה ובחבר מועדון לדוגמה. דגלי האתר, ה-API והספקים נשארים כבויים מחוץ לפיילוט שהוכן במפורש. סודות Wallet נשמרים בשרת בלבד. תעודות Apple תקינות וחשבון מנפיק Google נדרשים לבדיקות במכשירים.
2. פותחים את אזור הנאמנות של המסעדה ומתחברים לחשבון החבר. מוצגות פעולות רק לספקים שהשרת מציג כזמינים. הצגת העמוד אינה יוצרת כרטיס.
3. במכשיר Apple תואם, פעולת ההוספה שולחת טופס רגיל ומקבלת את קובץ הכרטיס החתום. פעולת Google מכינה את הכרטיס, מאמתת שוב את החשבון ופותחת את מסך Google. השלמת ההוספה דורשת עדיין בדיקה במכשיר אמיתי.
4. רענון קורא שוב את החברות ואת הכרטיסים. ״הכרטיס הוכן״ ו״עדכון ממתין״ מציינים מצב בשרת ואינם אישור להתקנה במכשיר.
5. השבתת כרטיס דורשת אישור מפורש. ביטול מחזיר את המיקוד לכפתור ואינו שולח בקשה. האישור משבית את הכרטיס ושומר על החברות, היתרה וההטבות. אין הבטחה להנפקה חדשה אם החברות או הספק אינם זמינים.
6. לאחר שגיאה או תשובה שאבדה, מרעננים לפני פעולה נוספת. אם ההפעלה השתנתה, בודקים את החשבון. פרטי שגיאה גולמיים של הספק אינם מוצגים. תצוגות מקדימות ומסגרות אינן פונות ל-Wallet.

### Critique visuelle et limites de vérification

Les captures `customer-wallet-fr-desktop.png`, `customer-wallet-he-mobile.png` et `customer-wallet-dark-confirm.png` ont été ouvertes et revues. La section reprend les séparateurs et le texte du restaurant ; elle suit la progression puis précède les droits attribués. Le badge Google est lisible et inchangé dans chaque langue. Le texte Apple demeure une action identifiable, moins saillante que le badge Google : l'artwork Apple approuvé reste une amélioration possible, sans imitation du badge. À 390 pixels, les actions passent en colonne, l'hébreu garde son sens de lecture et aucun débordement horizontal n'apparaît. Les cibles mesurées font au moins 44 pixels ; les actions d'ajout réservent 56 pixels. Le thème sombre conserve le contraste et une confirmation explicite. Les longues conditions peuvent placer cette section sous le premier écran ; la progression conserve ainsi sa priorité.

La revue a retiré une promesse de réémission après désactivation : un membre fermé ou un fournisseur indisponible ne peut pas forcément recevoir une nouvelle carte. Le retour du focus après Annuler a été ajouté et testé. Aucun faux pass ni compteur d'installation n'est présenté.

Les essais naviguent dans le vrai BFF avec des cookies synthétiques et interceptent toute destination externe ; l'écran Google est simulé. Le `.pkpass` de fixture est un ZIP de transport volontairement non signé et non installable, distinct des archives signées testées dans Go. Le contrôle du HTML complet, scripts compris, utilise `next start` : `next dev` sérialise les en-têtes dans ses diagnostics RSC, exclus seulement du contrôle DOM de développement. Cookies accessibles et stockages sont contrôlés dans les deux modes. Ces essais ne remplacent ni l'installation iPhone/Android, ni le scanner POS, ni l'acceptation des certificats et comptes réels.

Les 360 sources Web et 27 fichiers de revue exacte sont synchronisés dans le snapshot documentaire Web. Le catalogue, les guides FR/HE/EN, leurs dates et le corpus public restent strictement identiques au pin immuable `8460a012e28bbc4359613f68e4e01b7f15045c57` ; les cinq autres services conservent leurs blocs et surfaces. Les nouvelles preuves restent non commitées : elles ne constituent pas encore un checkpoint de publication. Résultats et gels finaux : `output/wallet-loyalty/lot3q-validation.json` et `lot3q-web-frozen.json`.
