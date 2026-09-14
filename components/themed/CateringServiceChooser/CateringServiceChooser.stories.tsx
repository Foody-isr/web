import { CateringServiceChooser } from "@/components/CateringServiceChooser";
import type { CateringServicePublic } from "@/services/api";

const story = { title: "Catering / Service chooser" };

export default story;

const translations: Record<string, string> = {
  catering_choose_service: "Choisir une prestation",
  catering_choose_service_hint:
    "Sélectionnez l’expérience qui correspond à votre réception. Vous pourrez ensuite en ajuster chaque détail.",
  catering_landing_headline: "Vous recevez. Nous dressons la table.",
  catering_landing_intro:
    "Découvrez nos prestations, composez un menu à votre mesure et recevez un devis clair.",
  catering_service_open: "Découvrir",
  catering_service_loading: "Ouverture…",
  catering_service_per_person_hint:
    "Choisissez une formule pensée pour votre nombre de convives.",
  catering_service_per_unit_hint:
    "Composez librement votre sélection et ajustez les quantités.",
  catering_service_custom_quote_hint:
    "Parlez-nous de votre réception pour recevoir une proposition sur mesure.",
  catering_how_choose: "Choisissez",
  catering_how_choose_hint: "Trouvez la prestation adaptée à votre réception.",
  catering_how_customize: "Personnalisez",
  catering_how_customize_hint: "Ajustez les formules, quantités et options.",
  catering_how_quote: "Recevez votre devis",
  catering_how_quote_hint:
    "Partagez vos informations pour finaliser la demande.",
};

const services: CateringServicePublic[] = [
  "PLATEAUX",
  "WEEKLY EVENT",
  "CHABAT PLEIN",
  "CHABAT LIVRAISON",
].map((name, index) => ({
  id: index + 1,
  name,
  slug: name.toLocaleLowerCase().replaceAll(" ", "-"),
  description: "",
  pricingModel: index === 0 ? "per_unit" : "per_person",
  quoteMode: "auto",
  depositPct: 0,
  selectionMode: "",
  allowExtraSessions: false,
  maxSessions: 3,
}));

export const Mamie = () => (
  <div
    className="min-h-screen bg-[var(--catering-bg)] text-[var(--text)]"
    style={
      {
        "--catering-bg": "#281c14",
        "--catering-accent": "#c87328",
        "--catering-button-ink": "#1e140e",
        "--bg-page": "#281c14",
        "--surface": "#3b291c",
        "--surface-subtle": "#332319",
        "--divider": "#5d402b",
        "--text": "#f1e7dc",
        "--text-muted": "#b8a28e",
        "--font-display": "Inter, sans-serif",
        "--font-body": "Inter, sans-serif",
      } as React.CSSProperties
    }
  >
    <CateringServiceChooser
      restaurantName="MAMIE"
      restaurantSlug="mamie"
      services={services}
      locale="fr"
      t={(key) => translations[key] ?? key}
      standalone
      loadingServiceId={null}
      onSelect={() => {}}
    />
  </div>
);
export const MamieWithCover = () => (
  <div
    className="min-h-screen bg-[var(--catering-bg)] text-[var(--text)]"
    style={
      {
        "--catering-bg": "#281c14",
        "--catering-accent": "#c87328",
        "--catering-button-ink": "#1e140e",
        "--bg-page": "#281c14",
        "--surface": "#3b291c",
        "--surface-subtle": "#332319",
        "--divider": "#5d402b",
        "--text": "#f1e7dc",
        "--text-muted": "#b8a28e",
        "--font-display": "Inter, sans-serif",
        "--font-body": "Inter, sans-serif",
      } as React.CSSProperties
    }
  >
    <CateringServiceChooser
      restaurantName="MAMIE"
      restaurantSlug="mamie"
      services={services}
      locale="fr"
      t={(key) => translations[key] ?? key}
      standalone
      coverUrl="https://images.unsplash.com/photo-1414235077428-338989a2e8c0"
      coverFocalX={54}
      coverFocalY={48}
      pageAppearance={{
        hero_title: "La réception, autrement.",
        hero_subtitle: "Une table généreuse, pensée pour votre moment.",
        show_restaurant_name: false,
        chooser_title: "Quel moment préparez-vous ?",
        chooser_subtitle:
          "Choisissez une prestation pour commencer votre devis.",
        service_action_label: "Voir l’offre",
        service_subtitles: {
          "2": "Un rendez-vous gourmand qui revient chaque semaine.",
        },
        show_steps: false,
      }}
      loadingServiceId={null}
      onSelect={() => {}}
    />
  </div>
);
