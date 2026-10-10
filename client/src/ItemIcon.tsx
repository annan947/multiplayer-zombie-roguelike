import { items } from '../../shared/items';
export function ItemIcon({ id }: { id: string }) {
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === id),
  );
  return (
    <span
      className="item-icon"
      aria-hidden="true"
      style={{
        backgroundPosition: `${((index % 4) * 100) / 3}% ${(Math.floor(index / 4) * 100) / 3}%`,
      }}
    />
  );
}
