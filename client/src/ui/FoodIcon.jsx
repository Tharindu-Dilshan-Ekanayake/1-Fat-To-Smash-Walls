import { useFoodIcon } from '../game/pets/petIcons'
import Icon from './Icon'

/**
 * A food's portrait, rendered from its 3D model (see petIcons.js) - the same food you
 * hold in your hand. Shows a faint placeholder for the frame or two before it's ready.
 *
 * @param {{ id: string, size: string|number, className?: string, style?: object }} props
 */
export function FoodIcon({ id, size, className = '', style }) {
  const url = useFoodIcon(id)
  if (!url) return <Icon name="food" size={size} className={className} style={{ opacity: 0.25, ...style }} />
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  )
}

export default FoodIcon
