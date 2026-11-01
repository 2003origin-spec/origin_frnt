---
title: "Mechanical Properties of Fluids: Short Notes"
type: short_notes
chapter: c11.physics.mechanical-properties-of-fluids
order: 2
---

## 1. What is a fluid?

- Liquids and gases are **fluids**: they can flow. They have no definite shape.
- A fluid at rest cannot resist a **shear** (sideways) stress. It only pushes **normal** (at right angles) to any surface in it.
- Liquids are nearly **incompressible**: their density is almost the same at all pressures. Gases are easily compressed.

## 2. Pressure

- **Pressure** = normal force per unit area, $P = F/A$. SI unit pascal (Pa) = N/m².
- Pressure is a **scalar**. At a point in a fluid at rest, it is the same in **all directions**.
- **Density** $\rho = m/V$ (kg/m³). **Relative density** = density of the substance / density of water at 4 °C. It has no unit.

:::remember
**Pascal's law:** the pressure in a fluid at rest is the same at all points at the **same height**. A change in pressure applied to an enclosed fluid is passed **undiminished** to every point of the fluid and to the walls of the vessel.
:::

## 3. Pressure and depth

For a liquid at rest, open to the air at the top:
$$P = P_a + \rho g h$$

- Pressure depends only on the **depth** $h$, not on the shape or cross-section of the vessel. This surprise is called the **hydrostatic paradox**: vessels of different shapes, filled to the same height, have the same pressure at the bottom.
- **Absolute pressure** $P$ includes the air pressure. **Gauge pressure** $P - P_a = \rho g h$ does not.

:::example{title="How deep for 2 atm?"}
At what depth in water is the absolute pressure twice the atmospheric pressure? ($P_a = 1.0 \times 10^5$ Pa)

$\rho g h = P_a$, so $h = \dfrac{10^5}{1000 \times 10} = 10$ m.
:::

## 4. Atmospheric pressure

- **Atmospheric pressure** = weight of the air column above unit area. At sea level, $P_a = 1.013 \times 10^5$ Pa = 1 atm.
- **Mercury barometer** (Torricelli): a mercury column of height $h$ is held up by the air, $P_a = \rho g h$. At sea level $h \approx 76$ cm, which is why 1 atm = 76 cm (760 mm) of Hg.
- Other units: 1 torr = 1 mm of Hg; 1 bar = $10^5$ Pa.
- An **open-tube manometer** (a U-tube with a liquid) measures **pressure differences**. The difference in levels $h$ gives the gauge pressure $\rho g h$.

## 5. Hydraulic machines

- Based on Pascal's law. A small force $F_1$ on a small piston (area $A_1$) creates pressure $F_1/A_1$. The same pressure acts on a big piston (area $A_2$), giving $F_2 = F_1 A_2/A_1$.
- The force is multiplied by $A_2/A_1$, but the big piston moves a shorter distance. The work done on both pistons is the same.
- Uses: **hydraulic lift**, **hydraulic brakes** in cars (a small push on the pedal acts equally on all the brake pads).

## 6. Streamline flow

- **Steady (streamline) flow:** the velocity of the fluid at each point does not change with time. Each particle follows a smooth path called a **streamline**.
- Two streamlines **never cross**. If they did, a particle at that point would have two velocities.
- Where streamlines crowd together (narrow part), the fluid moves **faster**.
- Above a **critical speed**, the flow becomes **turbulent**: irregular, with eddies, and it changes with time.

:::remember
**Equation of continuity:** $A_1 v_1 = A_2 v_2$. It is **conservation of mass** for an incompressible fluid in steady flow: the volume going in each second equals the volume coming out.
:::

## 7. Bernoulli's principle

Along a streamline, for steady flow of an incompressible, non-viscous fluid:
$$P + \tfrac12 \rho v^2 + \rho g h = \text{constant}$$

- It comes from the **work-energy theorem** (conservation of energy) applied to a moving volume of fluid.
- $\tfrac12\rho v^2$ = kinetic energy per unit volume; $\rho g h$ = potential energy per unit volume.
- At the same height: **faster flow, lower pressure.**
- With $v = 0$ (fluid at rest), it gives back $P_1 - P_2 = \rho g (h_2 - h_1)$.
- Limits: real fluids are viscous, so some energy turns into heat. Bernoulli does not hold for turbulent flow.

## 8. Speed of efflux: Torricelli's law

- Liquid flows out of a small hole at depth $h$ below the free surface of a large **open** tank with speed $v = \sqrt{2gh}$.
- This is the speed a body gains falling freely through $h$.
- If the tank is closed and the air above is at pressure $P$, then $v = \sqrt{2gh + 2(P - P_a)/\rho}$. When $P \gg P_a$, the $2gh$ term can be ignored.

## 9. Dynamic lift

**Dynamic lift** is the force on a body (aeroplane wing, hydrofoil, spinning ball) caused by its motion through a fluid.

| Case | What happens |
| --- | --- |
| Ball moving, no spin | Flow is the same above and below: no lift |
| Spinning ball | Air is dragged faster on one side, pressure is lower there: the ball swerves (**Magnus effect**) |
| Aerofoil (wing) | Shape and tilt make air flow faster above, so pressure below is higher: upward lift |

## 10. Viscosity

- **Viscosity** is the internal friction between layers of a fluid moving at different speeds. It opposes their relative motion.
- In **laminar** flow, layers slide over each other. The layer touching a fixed surface is at rest; the speed grows layer by layer.
- **Coefficient of viscosity:** $\eta = \dfrac{F/A}{v/l}$ (shear stress / rate of shear strain). SI unit poiseuille (Pl) = Pa s.

| Fluid | When temperature rises |
| --- | --- |
| Liquid | Viscosity **decreases** |
| Gas | Viscosity **increases** |

Example values (NCERT Table 9.2): water at 20 °C, $1.0 \times 10^{-3}$ Pa s; glycerine at 20 °C, 0.83 Pa s; air at 0 °C to 40 °C, about $1.7$ to $1.9 \times 10^{-5}$ Pa s.

## 11. Stokes' law and terminal velocity

- A small sphere of radius $a$ moving slowly through a viscous fluid feels a drag $F = 6\pi\eta a v$.
- A sphere falling through a fluid speeds up until weight = buoyant force + drag. After that it falls at a constant **terminal velocity**:
$$v_t = \frac{2a^2(\rho - \sigma)g}{9\eta}$$
- $v_t \propto a^2$: bigger drops fall faster.
- Because of the drag, a raindrop stops speeding up and reaches the ground at a modest speed, not the huge speed free fall from a cloud would give.

## 12. Surface tension

- A molecule inside a liquid is pulled equally from all sides. A molecule at the surface is pulled only inward and sideways, so it has **extra energy**. Making new surface needs work.
- **Surface tension** $S$ = force per unit length along a line on the surface = surface energy per unit area. Unit N/m.
- The liquid tries to keep its surface area as **small** as possible. Free drops are **spherical** for this reason.
- Surface tension usually **decreases** as temperature rises.

## 13. Angle of contact

- The **angle of contact** $\theta$ is the angle between the **tangent** to the liquid surface at the point of contact and the solid surface, measured **inside the liquid**.
- Water on clean glass: $\theta$ acute (close to $0^\circ$), water spreads (wets) and rises in a capillary. Mercury on glass: $\theta$ obtuse (about $140^\circ$), mercury forms drops and falls in a capillary. Water on a waxy or oily surface: $\theta$ obtuse.
- **Soaps and detergents** lower the surface tension of water and its angle of contact, so water wets cloth better and lifts out oily dirt. **Waterproofing agents** raise the angle of contact.

## 14. Drops, bubbles and capillary rise

- The pressure on the **concave** side of a curved liquid surface is **higher**.
- Drop or air bubble inside a liquid (one surface): $P_i - P_o = 2S/r$.
- Soap bubble in air (two surfaces): $P_i - P_o = 4S/r$.
- **Capillary rise:** in a narrow tube of radius $a$, the liquid rises to $h = \dfrac{2S\cos\theta}{\rho g a}$. Narrower tube, higher rise. Water rises; mercury is pushed down.
- Everyday capillary action: oil rising in a lamp wick, water soaking into a towel or blotting paper.
