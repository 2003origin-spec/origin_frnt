---
title: "Electromagnetic Waves: Important Points and Traps"
type: key_points
chapter: c12.physics.electromagnetic-waves
order: 3
---

## Displacement current

:::trap
Displacement current is **not** a flow of charge. No charge crosses the gap between capacitor plates. It is the name for $\varepsilon_0\,d\Phi_E/dt$, a changing electric field that makes a magnetic field just like a real current does.
:::

- In a charging capacitor, the conduction current in the wire **equals** the displacement current between the plates. Current is "continuous" round the circuit when you count both.
- Between the plates: $i_c = 0$, only $i_d$. In the wires: $i_d = 0$, only $i_c$.
- When the capacitor is **fully charged** on DC, $E$ stops changing, so $i_d = 0$ (and $i_c = 0$ too).
- On AC, the field between the plates keeps changing, so there is a displacement current between them. At every instant it equals the conduction current in the wires.

:::trap
Between circular plates, $B$ is **not** the same everywhere. It is zero on the axis, grows as $r$ inside the plates, peaks at the edge ($r = R$) and falls as $1/r$ outside. Inside, only the **fraction** $r^2/R^2$ of $i_d$ passes through your loop.
:::

:::remember
Maxwell added displacement current to remove the inconsistency in Ampere's circuital law. It acts as a source of magnetic field in exactly the same way as conduction current.
:::

## Sources

:::trap
Only **accelerated** charges radiate. A charge at rest: no. A steady current (charges at constant velocity): no. An oscillating charge, or a charge moving in a circle at constant speed (its velocity changes direction): yes.
:::

- The frequency of the EM wave equals the frequency of the oscillating charge. It is set by the source, so it does **not** change when the wave enters another medium.
- Hertz first made EM waves in the lab in **1887** (the NCERT Introduction prints 1885; Section 8.3.1 and the Summary say 1887).
- J. C. Bose made waves of 25 mm to 5 mm, seven years after Hertz. Marconi sent them over many kilometres.

## The wave itself

:::trap
$\vec E$ and $\vec B$ in an EM wave are **in phase**: both are maximum together and zero together. It is wrong to think that one field is largest when the other is zero.
:::

:::trap
$E_0 = cB_0$ makes $E_0$ look huge next to $B_0$ (for example 60 V/m and $2 \times 10^{-7}$ T). This is just the units. The **energy densities** of the two fields are equal (exam extra).
:::

- EM waves are **transverse**. There is nothing oscillating along the direction of travel.
- The wave travels along $\vec E \times \vec B$. Given $\vec E$ and the direction of travel $\hat k$, find $\vec B$ along $\hat k \times \vec E$.
- Order matters in the cross product: wave along $+z$ with $\vec E$ along $+x$ gives $\vec B$ along $+y$; with $\vec E$ along $+y$, $\vec B$ is along $-x$.
- Read the direction of travel from the sign: $\sin(kz - \omega t)$ moves along $+z$; $\sin(kz + \omega t)$ moves along $-z$.
- Speed $= \omega/k$. Always check: for a wave in vacuum this must come out as $3 \times 10^8$ m/s.

:::tip
To get $\lambda$ and $\nu$ from an equation like $\sin(ax + bt)$: $\lambda = 2\pi/a$ and $\nu = b/2\pi$. Don't take $a$ as $\lambda$ or $b$ as $\nu$.
:::

- EM waves need no medium. Sound is not an EM wave and cannot travel through vacuum.
- In vacuum, all EM waves (radio to gamma) have the same speed $c$. They differ only in wavelength (and frequency), and so in how they interact with matter.
- In a medium $v = 1/\sqrt{\mu\varepsilon}$ is **less** than $c$. The wavelength shrinks with it; the frequency does not change.

## Spectrum

:::remember
- Increasing wavelength: gamma, X-rays, UV, visible, infrared, microwaves, radio (NCERT: from about $10^{-12}$ m to $10^6$ m).
- Visible light: about 400 nm to 700 nm, $4 \times 10^{14}$ Hz to $7 \times 10^{14}$ Hz.
- Within visible light, violet has the shortest wavelength (highest frequency) and red the longest.
:::

:::trap
The band edges are **not sharp**. The NCERT text and Table 8.1 give different limits for UV, X-rays and gamma rays (X-rays: about 10 nm to $10^{-4}$ nm in the text, 1 nm to $10^{-3}$ nm in the table). The table values are the ones usually quoted. X-rays and gamma rays overlap; they are told apart by **origin**: gamma rays come from the nucleus, X-rays from electrons (X-ray tubes, inner-shell electrons).
:::

| Use | Wave |
| --- | --- |
| Radar, speed guns, microwave ovens | Microwaves |
| TV remote, physical therapy lamps | Infrared |
| Greenhouse effect | Infrared |
| LASIK, germ-killing in water purifiers | Ultraviolet |
| Bone and medical diagnosis | X-rays |
| Destroying cancer cells | Gamma rays (X-rays also treat some cancers) |
| AM, FM, TV, mobile phones | Radio waves |

- Infrared is called **heat waves** because water molecules (and $\ce{CO2}$, $\ce{NH3}$) absorb it and their thermal motion increases. Infrared vibrates whole atoms and molecules, not just electrons.
- Ordinary **glass absorbs UV**: no tanning through a window. Welders' goggles have glass windows for this reason.
- The ozone layer (about 40–50 km up) absorbs most of the Sun's UV.
- Microwave ovens work because the microwave frequency matches the **resonant frequency of water molecules** (NCERT's explanation).
- FM band: 88–108 MHz. AM band: 530–1710 kHz. TV: 54–890 MHz.
- Microwaves are made by klystrons, magnetrons and Gunn diodes.
- Gamma rays from a nucleus have wavelengths of about $10^{-14}$ to $10^{-15}$ m, around the size of a nucleus.
- The centre of our eye's sensitivity matches the centre of the Sun's wavelength distribution.

## Energy and pressure (exam extra)

- Average total energy density $\tfrac12\varepsilon_0E_0^2$ already includes **both** fields. The electric part alone is $\tfrac14\varepsilon_0E_0^2$.
- Radiation pressure is **double** for a perfect reflector ($2I/c$) compared with a perfect absorber ($I/c$).
- Intensity from a point source falls as $1/r^2$, so $E_0$ falls as $1/r$.

## NCERT lines to know

:::remember
- "Accelerated charges radiate electromagnetic waves."
- An electric dipole is a basic source of electromagnetic waves.
- The velocity of EM waves in vacuum is an important fundamental constant; it is the same for all wavelengths.
- Light is an electromagnetic wave. Maxwell's work unified electricity, magnetism and light.
:::
