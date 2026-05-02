import { DefaultSkin, NetflixSkin, type SkinProps, YouTubeSkin } from './skins';

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
