// Thin router that picks the active skin and forwards all props to it.
// Each skin (DefaultSkin / NetflixSkin / YouTubeSkin) implements SkinProps.

import { DefaultSkin, NetflixSkin, YouTubeSkin, type SkinProps } from './skins';

export function CustomControls(props: SkinProps) {
  switch (props.skin) {
    case 'netflix':
      return <NetflixSkin {...props} />;
    case 'youtube':
      return <YouTubeSkin {...props} />;
    case 'default':
    default:
      return <DefaultSkin {...props} />;
  }
}
