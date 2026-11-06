import { MAX_EQUIPPED_PETS } from '@shared/balance'
import { dailyStatus, isMaxLevel } from '@shared/logic'

import { useClearTop } from '../../bloxity/reserved'
import { useBloxityStore } from '../../bloxity/store'
import { useGame } from '../../store/game'
import useNow from '../useNow'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { AlertBadge, ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** The tiles' faces: deep, slightly purple-tinted squares, as in the reference. */
const TILE = 'linear-gradient(180deg, #8e7fd6 0%, #5a4aa8 55%, #3d2f80 100%)'
const TILE_RED = 'linear-gradient(180deg, #e8768a 0%, #b8344f 55%, #8a1f35 100%)'

function MenuTile({ icon, label, onClick, alert, top, pointer, red }) {
  return (
    <ChunkyButton gradient={red ? TILE_RED : TILE} onClick={onClick} title={label} radius={8} border={4} className="flex-col" style={{ width: u(98), height: u(98) }}>
      <Icon name={icon} size={u(74)} style={{ marginTop: u(-14) }} />
      <span className="absolute" style={{ bottom: u(2), fontSize: u(25) }}>
        <StrokeText stroke={u(6)}>{label}</StrokeText>
      </span>
      {top && (
        <span className="absolute" style={{ top: u(-20), right: u(-12), fontSize: u(26), transform: 'rotate(8deg)' }}>
          <StrokeText stroke={u(6)} gradient={GRADIENTS.priceShort} className="italic">
            {top}
          </StrokeText>
        </span>
      )}
      {alert && <AlertBadge size={36} style={{ top: u(-10), right: u(-12) }} />}
      {pointer && <Icon name="arrowDown" size={u(64)} className="pp-bounce absolute" style={{ top: u(-92) }} />}
    </ChunkyButton>
  )
}

/** The menu on the left, as in the reference: Pets, Store, Gifts, Rebirth, Items and Settings. */
export function LeftMenu() {
  const togglePanel = useGame((s) => s.togglePanel)
  const canRebirth = useGame((s) => isMaxLevel(s.profile))
  const petAlert = useGame((s) => s.profile.equippedPets.length < Math.min(MAX_EQUIPPED_PETS, s.profile.pets.length))
  const itemAlert = useGame((s) => Object.values(s.profile.items).some((n) => n > 0))
  const now = useNow(10000)
  // A boolean, not the profile: the menu re-renders when the alert changes, not on every bite.
  const giftAlert = useGame((s) => dailyStatus(s.profile, now).some((d) => d.state === 'ready'))
  // Inside Boxity its menu has the settings, and its toolbar and chat take the top-left.
  const embedded = useBloxityStore((s) => s.embedded)
  const clear = useClearTop(0, 0.3)

  return (
    // As in the reference on a full-size screen; higher up on short ones (landscape
    // phones), so it stays clear of the Coins and Fat in the corner below.
    <div
      className="pointer-events-none absolute flex flex-col"
      style={{ left: u(18), top: `max(${u(150)}, min(${u(340)}, calc(100vh - ${u(760)})), ${clear + 8}px)`, gap: u(12) }}
    >
      <div className="grid grid-cols-2" style={{ gap: u(8) }}>
        <MenuTile icon="pets" label="Pets" alert={petAlert} onClick={() => togglePanel('pets')} />
        <MenuTile icon="store" label="Store" top="SALE!" red onClick={() => togglePanel('store')} />
        <MenuTile icon="gift" label="Gifts" alert={giftAlert} onClick={() => togglePanel('daily')} />
        <MenuTile icon="rebirth" label="Rebirth" alert={canRebirth} red onClick={() => togglePanel('rebirth')} />
        <MenuTile icon="items" label="Items" alert={itemAlert} onClick={() => togglePanel('items')} />
        {!embedded && <MenuTile icon="gear" label="Settings" onClick={() => togglePanel('settings')} />}
      </div>
    </div>
  )
}

export default LeftMenu
