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
