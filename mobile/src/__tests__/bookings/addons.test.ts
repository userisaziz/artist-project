import { addonCountLabel, addonLineLabel, addonLines, decodeAddonPicks, encodeAddonPicks, removePick } from '../../utils/bookings/addons';
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

it('labels and removes picks like cart lines', () => {
  expect(addonCountLabel(0)).toBe('');
  expect(addonCountLabel(1)).toBe('1 add-on');
  expect(addonCountLabel(3)).toBe('3 add-ons');
  expect(addonLineLabel({ name: 'Guest mehendi', per_person: true, guests: 4 })).toBe('Guest mehendi × 4 guests');
  expect(addonLineLabel({ name: 'Guest mehendi', per_person: true, guests: 1 })).toBe('Guest mehendi × 1 guest');
  expect(addonLineLabel({ name: 'Organic henna upgrade', per_person: false, guests: 1 })).toBe('Organic henna upgrade');
  const picks = [{ addon_id: 'a-guests', guests: 4 }, { addon_id: 'a-upgrade', guests: 1 }];
  expect(removePick(picks, 'a-guests')).toEqual([{ addon_id: 'a-upgrade', guests: 1 }]);
});
