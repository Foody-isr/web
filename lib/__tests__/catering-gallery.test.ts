import assert from "node:assert/strict";
import test from "node:test";
import { cateringCarouselImages } from "../cateringGallery";
import type { CateringCatalogItemPublic } from "../../services/api";

function formula(): CateringCatalogItemPublic {
  return {
    id: 1,
    serviceId: 2,
    groupId: null,
    name: "Halavi event",
    slug: "halavi-event",
    overview: "",
    description: "",
    imageUrl: "https://cdn.example.com/cover.jpg",
    galleryImages: [
      { id: 3, imageUrl: "https://cdn.example.com/room.jpg", altText: "Room", translations: { alt_text: { fr: "Salle dressée" } } },
      { id: 4, imageUrl: "https://cdn.example.com/cover.jpg", altText: "Duplicate cover" },
      { id: 5, imageUrl: "https://cdn.example.com/buffet.jpg", altText: "" },
    ],
    basePrice: 200,
    priceTiers: [],
    minQuantity: 0,
    minGuests: 30,
    eventType: "",
    choiceGroups: [],
    includedItems: [],
  };
}

test("the catering carousel starts with the cover and preserves unique gallery photos", () => {
  assert.deepEqual(cateringCarouselImages(formula(), "fr"), [
    { key: "cover", url: "https://cdn.example.com/cover.jpg", alt: "Halavi event", isCover: true },
    { key: "gallery-3", url: "https://cdn.example.com/room.jpg", alt: "Salle dressée", isCover: false },
    { key: "gallery-5", url: "https://cdn.example.com/buffet.jpg", alt: "Halavi event", isCover: false },
  ]);
});
