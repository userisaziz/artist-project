import { addonLines, decodeAddonPicks, encodeAddonPicks } from '../../utils/bookings/addons';
import type { ServiceAddon } from '../../types/catalog/catalog';

const GUESTS: ServiceAddon = { id: 'a-guests', name: 'Guest mehendi', price_paise: 50000, per_person: true };
const UPGRADE: ServiceAddon = { id: 'a-upgrade', name: 'Organic henna upgrade', price_paise: 40000, per_person: false };
const OFFERED = [GUESTS, UPGRADE];

it('round-trips picks through a route param', () => {
  const picks = [{ addon_id: 'a-guests', guests: 4 }, { addon_id: 'a-upgrade', guests: 1 }];
  expect(decodeAddonPicks(encodeAddonPicks(picks), OFFERED)).toEqual(picks);
  expect(encodeAddonPicks([])).toBe('');
  expect(decodeAddonPicks(undefined, OFFERED)).toEqual([]);
});

it('drops picks that are off the menu, repeated or malformed, and keeps one guest for flat add-ons', () => {
  expect(decodeAddonPicks('a-gone:2,a-guests:0,a-guests:3,a-guests:5,a-upgrade:9,junk', OFFERED)).toEqual([
    { addon_id: 'a-guests', guests: 3 },
    { addon_id: 'a-upgrade', guests: 1 },
  ]);
});

it('prices each pick as unit price times guests', () => {
  const lines = addonLines(OFFERED, [{ addon_id: 'a-guests', guests: 4 }, { addon_id: 'a-upgrade', guests: 1 }]);
  expect(lines.map((l) => [l.addon.name, l.guests, l.line_paise])).toEqual([
    ['Guest mehendi', 4, 200000],
    ['Organic henna upgrade', 1, 40000],
  ]);
});
