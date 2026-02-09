import { MenuItem } from "@/lib/types";
import clsx from "clsx";
import { motion } from "framer-motion";
import Image from "next/image";

type Props = {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
};

export function MenuItemCard({ item, onSelect }: Props) {
  return (
    <motion.button
      layout
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => item.available !== false && onSelect(item)}
      disabled={item.available === false}
      className={clsx(
        "text-left card p-4 w-full transition",
        item.available === false ? "opacity-60 cursor-not-allowed" : "hover:shadow-xl"
      )}
    >
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg">{item.name}</p>
            {!item.available && (
              <span className="text-xs px-2 py-1 bg-light-subtle rounded-chip text-ink-muted font-medium">Sold out</span>
            )}
            {item.modifiers && item.modifiers.length > 0 && (
              <span className="text-xs px-2 py-1 bg-brand/15 text-brand rounded-chip font-medium">
                Customizable
              </span>
            )}
          </div>
          <p className="text-sm text-ink-muted line-clamp-2">{item.description}</p>
          <p className="font-bold text-brand">₪{item.price.toFixed(2)}</p>
        </div>
        <div className="relative h-24 w-24 overflow-hidden rounded-card bg-light-subtle">
          <Image
            src={
              item.imageUrl ||
              "https://images.unsplash.com/photo-1604908177693-2ba522bd87c7?auto=format&fit=crop&w=400&q=80"
            }
            alt={item.name}
            fill
            className="object-cover"
            sizes="100px"
          />
        </div>
      </div>
    </motion.button>
  );
}
