import React, { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, Line, RoundedBox } from '@react-three/drei';
import { animate, motion, useMotionValue } from 'motion/react';
import * as THREE from 'three';

/** 드래그해서 열어야 하는 최소 이동 거리 (px) */
const DRAG_THRESHOLD = 80;
/** 드래그 최대 이동 거리 — 이만큼 밀면 문이 완전히 열린다 */
const DOOR_TRAVEL = 200;
/**
 * 문이 완전히 열렸을 때의 회전각(라디안). 90도에 가까우면 화면과 평행해져 안 보이므로 여유를 둠.
 * 경첩이 오른쪽(hingeX = +halfW)에 있으므로 양수 각도로 돌아야 문이 카메라 쪽(+Z)으로 열린다.
 * 이 회전으로 문 손잡이(왼쪽)는 원근 투영상 화면 오른쪽으로 스윕한다 — 그래서 드래그도
 * 오른쪽 방향을 열기로 매핑해야 스와이프 방향과 문이 열리는 방향이 화면에서 일치한다.
 */
const MAX_OPEN_ANGLE = 1.55;

/** 냉장고 치수(임의 단위). 문 2장(냉동실/냉장실)이 있는 몸체 — tests/ref_1.png 참고 */
const WIDTH = 1.7;
const HEIGHT = 2.5;
const DEPTH = 1.25;
const FREEZER_HEIGHT = 0.85;
const PANEL = 0.06;

/** LoginView의 SVG 캐릭터와 동일한 브랜드 크림톤 — 배경(#FCF9F2)과 구분되도록 Edges 윤곽선과 함께 사용 */
const CREAM = '#f4f9e8';
const MINT = '#c8f17a';
const OLIVE = '#456805';
const OLIVE_SOFT = 'rgba(69, 104, 5, 0.55)';

interface FridgeEntryTransitionProps {
  onComplete: () => void;
}

type Phase = 'idle' | 'opening' | 'zooming';

/**
 * 문에 그리는 눈·볼·웃는 입 — tests/ref_1.png의 캐릭터를 3D 지오메트리로 옮김.
 * x는 문의 가로 중심(경첩 기준 로컬 좌표)을 넘겨받는다 — 안 넘기면 경첩 선(0)에 쏠려 보인다.
 */
function Face({ x, z }: { x: number; z: number }) {
  const smilePoints = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.16, 0, 0),
    new THREE.Vector3(0, -0.14, 0),
    new THREE.Vector3(0.16, 0, 0),
  ).getPoints(20);

  return (
    <group position={[x, 0.42, z]}>
      <mesh position={[-0.17, 0.14, 0]}>
        <circleGeometry args={[0.045, 20]} />
        <meshBasicMaterial color={OLIVE} />
      </mesh>
      <mesh position={[0.17, 0.14, 0]}>
        <circleGeometry args={[0.045, 20]} />
        <meshBasicMaterial color={OLIVE} />
      </mesh>
      <mesh position={[-0.32, -0.02, -0.005]}>
        <circleGeometry args={[0.07, 20]} />
        <meshBasicMaterial color={MINT} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.32, -0.02, -0.005]}>
        <circleGeometry args={[0.07, 20]} />
        <meshBasicMaterial color={MINT} transparent opacity={0.55} />
      </mesh>
      <Line points={smilePoints} color={OLIVE} lineWidth={3.5} />
    </group>
  );
}

/** 얇은 판(box) 하나 — 냉장고 몸체(뒤/좌/우/위/아래)를 이 패널들로 짜서 앞면이 뚫린 상자를 만든다 */
function Panel({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={CREAM} roughness={0.85} />
      {/* SVG 캐릭터의 올리브 stroke와 동일한 역할 — 윤곽선이 없으면 배경색과 거의 같은 크림톤이라
          음영만 남아 무채색 덩어리로 보인다 */}
      <Edges color={OLIVE} threshold={1} lineWidth={1.5} />
    </mesh>
  );
}

/**
 * 문 하나. pivot 그룹을 문의 오른쪽 모서리(경첩)에 두고, 문 메시 자체는 왼쪽으로
 * width/2 만큼 옮겨서 배치한다 — 그룹을 회전시키면 경첩을 축으로 문이 도는 것처럼 보인다
 * (CSS `transform-origin`과 같은 원리를 3D 피벗으로 구현). 경첩을 오른쪽에 둔 건
 * tests/ref_1.png 참고용 이미지의 손잡이가 왼쪽에 있어서다. 이 배치에서 문이 열리는 동안
 * 손잡이는 원근 투영상 화면 오른쪽으로 스윕하므로, 드래그 제스처는 오른쪽 방향을 열기로
 * 매핑한다(handlePointerMove 참고) — 그래야 스와이프 방향과 문이 열리는 방향이 화면에서 일치한다.
 */
function Door({
  pivotRef,
  hingeX,
  bottomY,
  width,
  height,
  showFace,
}: {
  pivotRef?: React.RefObject<THREE.Group | null>;
  hingeX: number;
  bottomY: number;
  width: number;
  height: number;
  showFace?: boolean;
}) {
  return (
    <group ref={pivotRef} position={[hingeX, bottomY, DEPTH / 2]}>
      <RoundedBox args={[width, height, PANEL * 1.4]} radius={0.05} smoothness={3} position={[-width / 2, height / 2, 0]}>
        <meshStandardMaterial color={CREAM} roughness={0.7} />
        <Edges color={OLIVE} threshold={1} lineWidth={1.5} />
      </RoundedBox>
      {/* 손잡이 (왼쪽) */}
      <mesh position={[-(width - 0.09), height / 2, PANEL * 0.8]}>
        <cylinderGeometry args={[0.028, 0.028, height * 0.32, 12]} />
        <meshStandardMaterial color={OLIVE} roughness={0.4} metalness={0.15} />
      </mesh>
      {showFace && <Face x={-width / 2} z={PANEL * 0.75} />}
    </group>
  );
}

function FridgeScene({
  phase,
  angle,
  zoomT,
}: {
  phase: Phase;
  angle: ReturnType<typeof useMotionValue<number>>;
  zoomT: ReturnType<typeof useMotionValue<number>>;
}) {
  const doorPivot = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const idleT = useRef(0);
  const { camera } = useThree();

  const startCam = useRef({ z: 5.4, y: 1.15, fov: 42 });
  const endCam = useRef({ z: -0.35, y: 1.35, fov: 100 });

  // R3F는 camera prop에 rotation이 없으면 camera.lookAt(0, 0, 0)을 기본 적용한다.
  // 냉장고 모델은 바닥(y=0)~천장(y=HEIGHT)으로 세워져 있어 원점을 보면 카메라가
  // 아래로 꺾여 상단(냉동실 문·얼굴)이 프레임 위로 잘려 나간다 — 모델의 세로 중심을 보게
  // 초기 방향을 다시 잡아준다(zooming 단계에서 쓰는 lookAt 타깃과 동일한 지점).
  useLayoutEffect(() => {
    camera.lookAt(0, 1.25, -0.4);
  }, [camera]);

  useFrame((_, delta) => {
    idleT.current += delta;

    if (doorPivot.current) {
      doorPivot.current.rotation.y = angle.get();
    }

    if (bodyGroup.current) {
      const breathe = phase === 'idle' ? Math.sin(idleT.current * 1.1) * 0.012 : 0;
      bodyGroup.current.scale.setScalar(1 + breathe);
    }

    const t = zoomT.get();
    if (t > 0) {
      const cam = camera as THREE.PerspectiveCamera;
      cam.position.z = THREE.MathUtils.lerp(startCam.current.z, endCam.current.z, t);
      cam.position.y = THREE.MathUtils.lerp(startCam.current.y, endCam.current.y, t);
      cam.fov = THREE.MathUtils.lerp(startCam.current.fov, endCam.current.fov, t);
      cam.lookAt(0, 1.25, -0.4);
      cam.updateProjectionMatrix();
    }
  });

  const halfW = WIDTH / 2;
  const mainDoorHeight = HEIGHT - FREEZER_HEIGHT;

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 3, 4]} intensity={0.9} />
      <pointLight position={[0, 1.6, -0.9]} intensity={1.4} color="#fff8c6" distance={3} />

      <group ref={bodyGroup} position={[0, 0, 0]}>
        {/* 몸체 — 앞면이 뚫린 상자(뒤/좌/우/위/아래 패널) */}
        <Panel position={[0, HEIGHT / 2, -DEPTH / 2]} size={[WIDTH, HEIGHT, PANEL]} />
        <Panel position={[-halfW, HEIGHT / 2, 0]} size={[PANEL, HEIGHT, DEPTH]} />
        <Panel position={[halfW, HEIGHT / 2, 0]} size={[PANEL, HEIGHT, DEPTH]} />
        <Panel position={[0, HEIGHT, 0]} size={[WIDTH, PANEL, DEPTH]} />
        <Panel position={[0, 0, 0]} size={[WIDTH, PANEL, DEPTH]} />

        {/* 선반 */}
        <Panel position={[0, mainDoorHeight * 0.35, -0.1]} size={[WIDTH - 0.14, 0.03, DEPTH - 0.3]} />
        <Panel position={[0, mainDoorHeight * 0.68, -0.1]} size={[WIDTH - 0.14, 0.03, DEPTH - 0.3]} />

        {/* 음식 소품 */}
        <mesh position={[-0.35, mainDoorHeight * 0.35 + 0.14, -0.15]}>
          <boxGeometry args={[0.18, 0.26, 0.18]} />
          <meshStandardMaterial color="#f68700" />
        </mesh>
        <mesh position={[0.05, mainDoorHeight * 0.35 + 0.11, -0.15]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={MINT} />
        </mesh>
        <mesh position={[0.35, mainDoorHeight * 0.68 + 0.15, -0.15]}>
          <boxGeometry args={[0.15, 0.3, 0.15]} />
          <meshStandardMaterial color="#88b04b" />
        </mesh>

        {/* 냉동실 문(위, 고정) — tests/ref_1.png처럼 얼굴은 이 문에 그린다 */}
        <Door hingeX={halfW} bottomY={mainDoorHeight} width={WIDTH} height={FREEZER_HEIGHT} showFace />
        {/* 냉장실 문(아래, 드래그로 여닫음) */}
        <Door pivotRef={doorPivot} hingeX={halfW} bottomY={0} width={WIDTH} height={mainDoorHeight} />
      </group>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={4} blur={2.2} far={2} />
    </>
  );
}

/**
 * 로그인 직후에만 표시되는 전체화면 3D 입장 트랜지션.
 * 냉장고 문을 오른쪽으로 당기거나 "들어가기" 버튼을 누르면 실제 3D 경첩 회전으로 문이 열리고,
 * 문이 다 열리면 카메라가 안쪽으로 밀고 들어가며(dolly-in) 화면이 밝게 번쩍인 뒤
 * 그 자리에서 앱의 홈 화면이 드러난다.
 *
 * 접근성: 드래그 불가 환경을 위해 "들어가기" 버튼이 항상 노출된다.
 */
export default function FridgeEntryTransition({ onComplete }: FridgeEntryTransitionProps) {
  const angle = useMotionValue(0);
  const zoomT = useMotionValue(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  const triggerOpen = () => {
    if (phase !== 'idle') return;
    setPhase('opening');
    animate(angle, MAX_OPEN_ANGLE, {
      type: 'spring',
      stiffness: 155,
      damping: 19,
      onComplete: () => {
        setTimeout(() => {
          setPhase('zooming');
          animate(zoomT, 1, { duration: 0.62, ease: [0.5, 0, 0.85, 0] });
          setTimeout(onComplete, 640);
        }, 260);
      },
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'idle') return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    // dx는 0(닫힘)→+DOOR_TRAVEL(다 열림)로 움직인다. 문 손잡이는 원근 투영상 화면
    // 오른쪽으로 스윕하며 열리므로(MAX_OPEN_ANGLE 주석 참고), 오른쪽 드래그를 열기로 매핑해야
    // 스와이프 방향과 문이 열리는 방향이 화면에서 일치한다.
    const dx = Math.max(0, Math.min(DOOR_TRAVEL, e.clientX - startXRef.current));
    angle.set((dx / DOOR_TRAVEL) * MAX_OPEN_ANGLE);
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const openedEnough = (angle.get() / MAX_OPEN_ANGLE) * DOOR_TRAVEL >= DRAG_THRESHOLD;
    if (openedEnough) {
      triggerOpen();
    } else {
      animate(angle, 0, { type: 'spring', stiffness: 420, damping: 36 });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-8 overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="w-full flex-1" style={{ maxHeight: 460 }}>
        <Suspense fallback={null}>
          <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 1.15, 5.4], fov: 42 }}
            gl={{ antialias: true, alpha: true }}
          >
            <FridgeScene phase={phase} angle={angle} zoomT={zoomT} />
          </Canvas>
        </Suspense>
      </div>

      {/* 힌트 + 접근성 버튼 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'idle' ? 1 : 0 }}
        transition={{ duration: 0.3, delay: phase === 'idle' ? 0.5 : 0 }}
        className="flex flex-col items-center gap-3"
        aria-live="polite"
      >
        <motion.p
          animate={{ x: [0, 7, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', repeatDelay: 0.15 }}
          className="text-sm text-on-surface-variant flex items-center gap-1.5"
          aria-hidden
        >
          문을 열어 들어가세요 →
        </motion.p>
        <button
          onClick={triggerOpen}
          disabled={phase !== 'idle'}
          className="px-7 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          aria-label="냉장고 문 열고 앱으로 들어가기"
          style={{ borderColor: OLIVE_SOFT }}
        >
          들어가기
        </button>
      </motion.div>

      {/* 문이 다 열린 뒤 카메라가 안으로 들어가며 화면을 하얗게 훅 채우는 플래시 */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 45%, #fffdf3 0%, #fdf6d8 55%, transparent 78%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'zooming' ? [0, 0.12, 1] : 0 }}
        transition={{ duration: 0.62, times: [0, 0.45, 1], ease: 'easeIn' }}
        aria-hidden
      />
    </motion.div>
  );
}
