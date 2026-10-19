
import DotGrid from './DotGrid.jsx';

export default function CertiFlowDotOverlay({
  color = '#BBA7DB',
  opacity = 0.35,
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      <DotGrid
        baseColor="#3A3446"
        activeColor={color}
        shape="circle"
        dotSize={2}
        gap={22}
        proximity={130}
        strength={0.5}
        bounce={0.4}
        tension={0.45}
        returnDuration={0.8}
        shockRadius={240}
        shockStrength={2}
        swell={0.8}
        stretch={0.3}
        glow={0.25}
        fade={0.15}
        intro={true}
        opacity={opacity}
        mouseInteraction={false}
        clickShock={false}
      />
    </div>
  );
}
