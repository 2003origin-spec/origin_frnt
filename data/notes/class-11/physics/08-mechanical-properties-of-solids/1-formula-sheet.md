---
title: "Mechanical Properties of Solids: Formula Sheet"
type: formula_sheet
chapter: c11.physics.mechanical-properties-of-solids
order: 1
---

## Stress and strain

:::formula{title="Stress"}
$$\sigma = \frac{F}{A}$$
$F$ = restoring force (equal in size to the applied force), $A$ = area it acts on. Unit N m⁻² = Pa. Dimensions $[\mathrm{ML^{-1}T^{-2}}]$, the same as pressure.
:::

:::formula{title="Longitudinal strain"}
$$\varepsilon = \frac{\Delta L}{L}$$
$\Delta L$ = change in length, $L$ = original length. For tensile (stretching) or compressive stress.
:::

:::formula{title="Shearing strain"}
$$\text{shearing strain} = \frac{\Delta x}{L}$$
$$\frac{\Delta x}{L} = \tan\theta \approx \theta$$
$\Delta x$ = sideways shift of one face relative to the opposite face, $L$ = distance between those faces (height). $\theta$ in **radians**. $\tan\theta \approx \theta$ only for small $\theta$ (at $10^\circ$ the difference is about 1%).
:::

:::formula{title="Volume strain"}
$$\text{volume strain} = \frac{\Delta V}{V}$$
For a body under uniform (hydraulic) pressure. The shape does not change. Every strain is a ratio, so it has **no unit and no dimensions**.
:::

## Hooke's law

:::formula{title="Hooke's law"}
$$\text{stress} = k \times \text{strain}$$
$k$ = modulus of elasticity (unit Pa). Valid only for **small deformations**, in the linear part of the stress-strain curve. It is an empirical law; elastomers (rubber, aorta tissue) do not obey it.
:::

## The three elastic moduli

:::formula{title="Young's modulus Y"}
$$Y = \frac{\sigma}{\varepsilon} = \frac{F/A}{\Delta L/L}$$
$$Y = \frac{FL}{A\,\Delta L}$$
For tensile or compressive stress. Holds in the linear (Hooke's law) region. **Solids only.**
:::

:::formula{title="Extension of a wire"}
$$\Delta L = \frac{FL}{AY}$$
$F$ = tension in the wire (for a light wire with a load $Mg$, $F = Mg$). For a round wire, $A = \pi r^2 = \dfrac{\pi d^2}{4}$. The wire's own weight is ignored.
:::

:::formula{title="Shear modulus (modulus of rigidity) G"}
$$G = \frac{F/A}{\Delta x/L} = \frac{FL}{A\,\Delta x}$$
$$G = \frac{F}{A\,\theta}$$
$$\sigma_s = G\,\theta$$
$F$ = tangential force, $A$ = area of the face **parallel** to $F$. **Solids only.** For most materials $G \approx Y/3$.
:::

:::formula{title="Bulk modulus B"}
$$B = -\frac{p}{\Delta V/V}$$
$p$ = **increase** in pressure (hydraulic stress), $\Delta V$ = change in volume (negative when $p$ is positive), so $B$ is always positive. Solids, liquids **and** gases.
:::

:::formula{title="Compressibility"}
$$k = \frac{1}{B} = -\frac{1}{\Delta p}\,\frac{\Delta V}{V}$$
Fractional change in volume per unit increase in pressure. Unit Pa⁻¹ (m² N⁻¹). Gases are the most compressible, solids the least.
:::

## Poisson's ratio

:::formula{title="Poisson's ratio"}
$$\nu = \frac{\Delta d/d}{\Delta L/L}$$
$$\nu = \frac{\Delta d}{\Delta L}\times\frac{L}{d}$$
$\Delta d/d$ = lateral strain (fractional decrease in diameter), $\Delta L/L$ = longitudinal strain. NCERT gives it no symbol; we write $\nu$ because $\sigma$ already means stress. Pure number, no unit. Within the elastic limit. Steel: 0.28 to 0.30; aluminium alloys: about 0.33.
:::

## Elastic potential energy of a stretched wire

:::formula{title="Energy stored"}
$$U = \frac{1}{2}\,\frac{YA}{L}\,l^2 = \frac{1}{2}F\,l$$
$l$ = extension, $F$ = final stretching force. Within the Hooke's law region (force grows linearly from 0 to $F$).
:::

:::formula{title="Energy in terms of stress and strain"}
$$U = \frac{1}{2}\,\sigma\,\varepsilon\,(AL)$$
$$u = \frac{1}{2}\,\sigma\,\varepsilon$$
That is, $U = \frac12 \times$ stress $\times$ strain $\times$ volume, where $AL$ = volume of the wire. $u$ = energy per unit volume (J m⁻³). With $\sigma = Y\varepsilon$ this is also $\dfrac12 Y\varepsilon^2 = \dfrac{\sigma^2}{2Y}$.
:::

## Applications (NCERT section 8.6)

:::formula{title="Thickness of a crane rope"}
$$A \ge \frac{Mg}{\sigma_y}$$
$\sigma_y$ = yield strength. Keeps the rope inside the elastic limit (no permanent stretch). In practice a safety factor of about 10 on the load is used.
:::

:::formula{title="Sag of a beam loaded at the centre"}
$$\delta = \frac{W l^3}{4\,b\,d^3\,Y}$$
Rectangular bar supported near its ends, load $W$ at the centre. $l$ = length, $b$ = breadth, $d$ = depth (vertical thickness). $\delta \propto 1/d^3$ but only $\propto 1/b$, so depth matters most.
:::

:::formula{title="Greatest height of a mountain"}
$$h\rho g \le \sigma_{\text{limit}}$$
$$h_{max} = \frac{\sigma_{\text{limit}}}{\rho g}$$
With NCERT's values ($3 \times 10^8$ N m⁻² for rock, $\rho = 3\times10^3$ kg m⁻³, $g = 10$ m s⁻²), $h_{max} \approx 10$ km.
:::

## Exam extras (not in the NCERT chapter)

:::formula{title="A wire as a spring"}
$$F = \frac{YA}{L}\,\Delta L$$
$$k_{wire} = \frac{YA}{L}$$
So a wire behaves like a spring of force constant $k_{wire}$ (unit N m⁻¹), within the Hooke's law region. Wires joined end to end add like springs in series; wires side by side sharing a load add like springs in parallel.
:::

:::formula{title="Extension under its own weight"}
$$\Delta L = \frac{MgL}{2AY} = \frac{\rho g L^2}{2Y}$$
Uniform wire or rod of mass $M$ hanging from one end, no extra load. Half of what the same weight hung at the end would give.
:::

:::formula{title="Thermal stress"}
$$\sigma = Y\alpha\,\Delta T$$
Rod that just fits, unstressed, between two **rigid** walls, then heated by $\Delta T$. The stress is **compressive** (cooling instead gives tensile stress). $\alpha$ = coefficient of linear expansion. Force on the walls $= YA\alpha\,\Delta T$.
:::

:::formula{title="Relations between moduli (isotropic material)"}
$$Y = 2G(1 + \nu)$$
$$Y = 3B(1 - 2\nu)$$
In theory $-1 < \nu \le 0.5$; almost all real materials have $0 < \nu < 0.5$.
:::

:::formula{title="Small changes in volume and density"}
$$\frac{\Delta V}{V} = \varepsilon\,(1 - 2\nu)$$
Stretched wire with longitudinal strain $\varepsilon$; no volume change if $\nu = 0.5$.
$$\frac{\Delta r}{r} = \frac{1}{3}\,\frac{\Delta V}{V}$$
$$\rho' \approx \rho\left(1 + \frac{p}{B}\right)$$
For a sphere under pressure, and for density under extra pressure $p$. Small strains only.
:::

:::formula{title="Bulk modulus of a gas"}
$$B_{\text{isothermal}} = p$$
$$B_{\text{adiabatic}} = \gamma p$$
$p$ = gas pressure, $\gamma = C_p/C_v$. Air at STP: about $1.0 \times 10^5$ Pa (NCERT table).
:::
