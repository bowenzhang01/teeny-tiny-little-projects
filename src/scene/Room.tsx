const solid = { kind: 'solid' } as const

/**
 * 简单的室内射击室：
 * - 10m 宽 × 4.6m 高的长条房间，纵深约 16m
 * - 射手站在 z≈0，标靶在 z≈-9（由距离参数控制）
 */
export function Room() {
  return (
    <group>
      {/* 地板 */}
      <mesh position={[0, -0.1, -5]} receiveShadow userData={solid}>
        <boxGeometry args={[10, 0.2, 16.8]} />
        <meshStandardMaterial color="#22262e" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* 天花板 */}
      <mesh position={[0, 4.7, -5]} userData={solid}>
        <boxGeometry args={[10, 0.2, 16.8]} />
        <meshStandardMaterial color="#181b21" roughness={0.95} />
      </mesh>

      {/* 后墙（射手背后） */}
      <mesh position={[0, 2.4, 3.3]} userData={solid}>
        <boxGeometry args={[10, 4.8, 0.2]} />
        <meshStandardMaterial color="#2c313b" roughness={0.9} />
      </mesh>

      {/* 前墙（标靶背后） */}
      <mesh position={[0, 2.4, -13.3]} userData={solid}>
        <boxGeometry args={[10, 4.8, 0.2]} />
        <meshStandardMaterial color="#272b33" roughness={0.9} />
      </mesh>

      {/* 左右墙 */}
      <mesh position={[5, 2.4, -5]} userData={solid}>
        <boxGeometry args={[0.2, 4.8, 16.8]} />
        <meshStandardMaterial color="#2a2e37" roughness={0.9} />
      </mesh>
      <mesh position={[-5, 2.4, -5]} userData={solid}>
        <boxGeometry args={[0.2, 4.8, 16.8]} />
        <meshStandardMaterial color="#2a2e37" roughness={0.9} />
      </mesh>

      {/* 地面标线：两条射击道边界 + 射击位横线 */}
      <mesh position={[-3.3, 0.011, -4.9]} userData={solid}>
        <boxGeometry args={[0.08, 0.02, 15.4]} />
        <meshStandardMaterial color="#3f4550" roughness={0.85} />
      </mesh>
      <mesh position={[3.3, 0.011, -4.9]} userData={solid}>
        <boxGeometry args={[0.08, 0.02, 15.4]} />
        <meshStandardMaterial color="#3f4550" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.012, 1.9]} userData={solid}>
        <boxGeometry args={[6.6, 0.02, 0.3]} />
        <meshStandardMaterial color="#4b5160" roughness={0.85} />
      </mesh>

      {/* 天花板灯槽发光体（纯装饰） */}
      {[-2, -7].map((z) => (
        <mesh key={z} position={[0, 4.58, z]}>
          <boxGeometry args={[0.8, 0.06, 1.4]} />
          <meshStandardMaterial
            color="#dfe7f5"
            emissive="#cfd9ec"
            emissiveIntensity={1.6}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  )
}

/** 房间灯光：一盏主方向光 + 两盏顶部射灯 */
export function RoomLights() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#9aa3b5', '#15181f', 0.55]} />
      <directionalLight
        castShadow
        position={[3.5, 6, 2.5]}
        intensity={2.4}
        color="#eef1f7"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <pointLight position={[0, 4.35, 0]} intensity={32} distance={15} decay={1.6} color="#e8ecf5" />
      <pointLight position={[0, 4.35, -5]} intensity={32} distance={15} decay={1.6} color="#e8ecf5" />
      <pointLight position={[0, 4.35, -10]} intensity={28} distance={14} decay={1.6} color="#e8ecf5" />
    </>
  )
}
