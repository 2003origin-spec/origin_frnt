---
title: "Mechanical Properties of Fluids: Formula Sheet"
type: formula_sheet
chapter: c11.physics.mechanical-properties-of-fluids
order: 1
---

## Pressure

:::formula{title="Pressure and density"}
$$P = \frac{F}{A}$$
$$\rho = \frac{m}{V}$$
$F$ = normal force on area $A$. Unit of $P$: pascal, 1 Pa = 1 N/m². Pressure is a **scalar**. Unit of $\rho$: kg/m³. Relative density = $\rho / \rho_{water}$ (no unit); $\rho_{water} = 1.00 \times 10^3$ kg/m³ at 4 °C.
:::

:::formula{title="Pressure at depth h"}
$$P = P_a + \rho g h$$
$P_a$ = atmospheric pressure on the open surface, $h$ = depth below that surface. Holds for a fluid **at rest** with constant $\rho$ (a liquid). It does not depend on the shape or area of the vessel.
:::

:::formula{title="Gauge pressure"}
$$P - P_a = \rho g h$$
Gauge pressure = absolute pressure minus atmospheric pressure. Pressure gauges and open-tube manometers read this.
:::

:::formula{title="Atmospheric pressure (mercury barometer)"}
$$P_a = \rho_{Hg}\, g\, h$$
At sea level $h = 76$ cm of mercury, so $P_a = 1.013 \times 10^5$ Pa = 1 atm.
1 bar = $10^5$ Pa. 1 torr = 1 mm of Hg $\approx 133$ Pa.
:::

:::formula{title="Hydraulic lift (Pascal's law)"}
$$\frac{F_1}{A_1} = \frac{F_2}{A_2}$$
$$F_2 = F_1 \frac{A_2}{A_1}$$
The same pressure is passed to every part of an enclosed liquid. Volume pushed in = volume pushed out, so $A_1 d_1 = A_2 d_2$: the big piston moves a **shorter** distance. No energy is gained.
:::

## Fluid flow

:::formula{title="Equation of continuity"}
$$A_1 v_1 = A_2 v_2$$
$Av$ = volume flux (m³/s). Holds for **steady flow** of an **incompressible** fluid. Narrow part, faster flow.
:::

:::formula{title="Bernoulli's equation"}
$$P + \tfrac12 \rho v^2 + \rho g h = \text{constant}$$
Along a streamline. Holds for **steady** (streamline) flow of an **incompressible, non-viscous** fluid. Every term has the unit of pressure (energy per unit volume).
:::

:::formula{title="Horizontal pipe"}
$$P_1 + \tfrac12\rho v_1^2 = P_2 + \tfrac12\rho v_2^2$$
Same height: where the speed is higher, the pressure is lower.
:::

:::formula{title="Fluid at rest (from Bernoulli)"}
$$P_1 - P_2 = \rho g (h_2 - h_1)$$
With $v = 0$, Bernoulli gives back the pressure-depth relation.
:::

:::formula{title="Speed of efflux (Torricelli's law)"}
$$v = \sqrt{2gh}$$
Tank **open** to the air, hole a depth $h$ below the free surface, hole much smaller than the tank. Same as the speed of a body falling freely through $h$. It does not depend on the liquid's density.

If the tank is closed and the air above the liquid is at pressure $P$:
$$v = \sqrt{2gh + \frac{2(P - P_a)}{\rho}}$$
:::

## Viscosity

:::formula{title="Coefficient of viscosity"}
$$\eta = \frac{F/A}{v/l}$$
Shear stress divided by the rate of shear strain. $v$ = speed of the moving layer (or plate), $l$ = distance from the fixed layer.
SI unit: poiseuille (Pl) = N s m⁻² = Pa s. Dimensions $[\text{ML}^{-1}\text{T}^{-1}]$. (CGS unit: 1 poise = 0.1 Pa s.)
:::

:::formula{title="Stokes' law"}
$$F = 6\pi \eta a v$$
Viscous drag on a sphere of radius $a$ moving at speed $v$. Holds for a **small** sphere at **low speed** (streamline flow around it) in a fluid of large extent.
:::

:::formula{title="Terminal velocity"}
$$v_t = \frac{2a^2(\rho - \sigma)g}{9\eta}$$
$\rho$ = density of the sphere, $\sigma$ = density of the fluid. Reached when weight = buoyant force + viscous drag. If $\rho < \sigma$ (an air bubble), $v_t$ comes out negative: the body rises.
:::

## Surface tension

:::formula{title="Surface tension"}
$$S = \frac{F}{l}$$
Force per unit length on a line drawn on the surface. Unit N/m (= J/m²), dimensions $[\text{MT}^{-2}]$.
A film on a frame has **two** surfaces, so a wire of length $l$ feels $F = 2Sl$.
:::

:::formula{title="Surface energy"}
$$W = S \, \Delta A$$
Surface tension = extra energy per unit area of surface (isothermal stretching). For a film, $\Delta A$ counts **both** sides.
:::

:::formula{title="Angle of contact"}
$$S_{la}\cos\theta + S_{sl} = S_{sa}$$
$$\cos\theta = \frac{S_{sa} - S_{sl}}{S_{la}}$$
$S_{la}$, $S_{sa}$, $S_{sl}$ = liquid-air, solid-air, solid-liquid surface tensions. $\theta < 90^\circ$: liquid wets the solid. $\theta > 90^\circ$: it does not.
:::

:::formula{title="Excess pressure: drop or air bubble in a liquid"}
$$P_i - P_o = \frac{2S}{r}$$
One surface. $P_i$ = pressure inside, $P_o$ = outside, $r$ = radius. The concave side is always at higher pressure.
:::

:::formula{title="Excess pressure: soap bubble in air"}
$$P_i - P_o = \frac{4S}{r}$$
Two surfaces (inner and outer), so twice the value for a drop.
:::

:::formula{title="Capillary rise"}
$$h = \frac{2S\cos\theta}{\rho g a}$$
$a$ = radius of the tube, $\theta$ = angle of contact, $\rho$ = density of the liquid. Narrow tube, so the meniscus is close to part of a sphere. $\theta > 90^\circ$ (mercury) gives a negative $h$: the liquid falls.
For water in clean glass, $\theta \approx 0$, so $h = \dfrac{2S}{\rho g a}$.
:::

## Exam extras (not in the current NCERT text)

:::formula{title="Reynolds number"}
$$R_e = \frac{\rho v d}{\eta}$$
$\rho$ = density of the fluid, $v$ = flow speed, $d$ = pipe diameter. No unit. The cut-offs are only **approximate** (older NCERT values): below about 1000 the flow is streamline, above about 2000 it is turbulent, and in between it is unsteady. Critical speed $v_c = \dfrac{R_e\,\eta}{\rho d}$.
:::

:::formula{title="Buoyant force (Archimedes' principle)"}
$$F_B = \rho_{fluid}\, V_{sub}\, g$$
$V_{sub}$ = volume of the body under the fluid. A floating body: weight = $F_B$. This chapter uses the buoyant force (in terminal velocity) but does not state the principle; the current NCERT Class 9 book does not teach it either.
:::

:::formula{title="Venturi meter"}
$$v_1 = \sqrt{\frac{2\rho_m g h}{\rho\left[(A_1/A_2)^2 - 1\right]}}$$
$v_1$ = speed in the wide part (area $A_1$), $A_2$ = throat area, $\rho$ = density of the flowing fluid, $h$ = level difference in a manometer of liquid density $\rho_m$. This form is for a **gas** flowing (its density is tiny next to $\rho_m$). For a **liquid** flowing, replace $\rho_m$ by $(\rho_m - \rho)$.
:::

:::formula{title="Splitting a drop into n equal drops"}
$$r = \frac{R}{n^{1/3}}$$
$$W = 4\pi R^2 S\,(n^{1/3} - 1)$$
Volume is conserved; the surface area grows, so work $W$ must be done.
:::

:::formula{title="Liquid in an accelerating vessel"}
$$\tan\theta = \frac{a}{g}$$
$$P - P_a = \rho (g + a) h$$
Here $a$ = acceleration of the vessel (not a radius) and $\theta$ = tilt of the free surface from the horizontal (not the angle of contact). First: horizontal acceleration $a$. Second: vessel accelerating **upward** at $a$, $h$ = depth.
:::
