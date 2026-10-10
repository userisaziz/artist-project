import { PlaceholderHome } from '../../src/components/PlaceholderHome';

// Customer home. This route only mounts for a customer (the root gate guards the folder),
// so the role is fixed here — no runtime branching. Grows into browse/orders later.
export default function CustomerHome() {
  return <PlaceholderHome role="Customer" />;
}
