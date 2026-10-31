---
title: "Wave Optics: Important Points and Traps"
type: key_points
chapter: c12.physics.wave-optics
order: 3
---

## Wavefronts and refraction

- A wavefront is a surface of **constant phase**. When the speed of light is the same in every direction (glass, water, air), rays are perpendicular to it.
- The wave model says light is **slower** in a denser medium; the corpuscular model said **faster**. Experiment (Foucault, 1850) backed the wave model.

:::trap
On refraction, the **frequency** (and so the colour) does **not** change. Speed and wavelength change: in a medium of index $n$ both are $1/n$ times their vacuum values. A question that asks for "the frequency in glass" wants the same value as in air.
:::

:::trap
Light slowing down in glass does **not** mean it loses energy. The energy a wave carries depends on its **amplitude**, not its speed (NCERT Example 10.1).
:::

- Reflected and refracted light have the **same frequency** as the incident light: the atoms of the medium are forced to oscillate at the frequency of the light and re-emit at that frequency.
- In the photon picture, the intensity (for a given frequency) is set by the **number of photons** crossing unit area per unit time.

:::remember
Wavefront shapes (NCERT Exercise 10.2):
- light diverging from a point source: **spherical**;
- a point source at the focus of a convex lens, after the lens: **plane**;
- the part of a distant star's wavefront that reaches the Earth: **plane**.
:::

## Interference

:::trap
Two separate bulbs or two sodium lamps **never** give a steady interference pattern, even with the same colour. Their phases jump at random about every $10^{-10}$ s, so they are incoherent and the intensities just add ($2I_0$).
:::

- Coherent sources must come from a **single** original source (Young's two slits lit by one pinhole).
- Path difference $\lambda$ = phase difference $2\pi$. So $\lambda/2 \to \pi$, $\lambda/4 \to \pi/2$, $\lambda/3 \to 2\pi/3$.
- With two equal slits, the bright fringe has $4I_0$, **not** $2I_0$. The average over the pattern is still $2I_0$: energy is only moved from dark to bright places.

:::trap
The first **dark** fringe is at $\beta/2$ from the centre, not at $\beta$. The $n$th dark fringe from the centre is at $\left(n - \tfrac12\right)\beta$ when you count $n = 1, 2, 3, \dots$ (NCERT's formula counts from $n = 0$).
:::

:::trap
$I = 4I_0\cos^2(\phi/2)$ uses **half** the phase difference. At $\phi = 2\pi/3$ (path difference $\lambda/3$): $\cos^2 60^\circ = \tfrac14$, so $I = I_0$, which is a quarter of the maximum.
:::

- Fringe width does **not** depend on the order: all fringes are equally wide.
- Covering one slit removes the interference fringes. Only the (much broader) single-slit diffraction pattern of the open slit is left.
- (Exam extra) If the two slits give unequal intensities, the dark fringes are **not** completely dark: $I_{min} = (\sqrt{I_1} - \sqrt{I_2})^2$.
- (Exam extra) A thin glass sheet over one slit shifts the whole pattern **towards that slit**. The fringe width stays the same.

:::tip
$\beta = \dfrac{\lambda D}{d}$: $\lambda$ and $D$ go on top, the slit gap $d$ goes below. Bigger $\lambda$ or $D$ spreads the fringes; bigger $d$ squeezes them.
:::

## Diffraction

:::trap
The single-slit **minimum** condition, $a\theta \approx n\lambda$, looks like the YDSE **maximum** condition, $d\theta \approx n\lambda$. Don't mix them up. In a single slit, $\theta \approx \lambda/a$ is the first **dark** band. (Why: pair each point of the upper half of the slit with a point in the lower half; their waves differ by $\lambda/2$ and cancel.)
:::

- The central maximum is **twice** as wide as each secondary maximum, and much brighter.
- A **narrower** slit gives a **wider** central maximum. Making the slit wider makes the pattern shrink towards the centre.
- **Red** light gives wider bands than **blue** light (larger $\lambda$). The positions of all bands except the central one depend on $\lambda$, so with white light they are coloured.
- Diffraction of light is not noticed every day because $\lambda$ is tiny compared with most objects. Sound, with a wavelength of the order of a metre, bends round corners easily.

:::remember
- Diffraction limits how well the eye, telescopes and microscopes can separate very close objects (NCERT "Points to ponder").
- The double-slit pattern is single-slit diffraction from each slit **combined** with double-slit interference.
:::

## Polarisation

:::trap
In Malus' law $I = I_0\cos^2\theta$:
- $I_0$ is the intensity of the **already polarised** light (after the first polaroid), not the unpolarised intensity;
- $\theta$ is the angle between the two **pass axes**.

For unpolarised light $I_{unpol}$ through two polaroids: $I = \tfrac12 I_{unpol}\cos^2\theta$.
:::

- Rotating a **single** polaroid in unpolarised light changes nothing: always half the intensity.
- Two crossed polaroids pass **nothing**. Put a third one between them at $45^\circ$ and light gets through: $I_0/4$, where $I_0$ is the intensity after the first polaroid (NCERT Example 10.2).
- Rotating the second polaroid through a full turn: intensity is maximum twice and zero twice.
- The pass axis of a polaroid is **perpendicular** to its aligned long-chain molecules.

:::trap
Only **transverse** waves can be polarised. Sound in air (longitudinal) shows interference and diffraction but **cannot** be polarised. Polarisation is the proof that light is transverse.
:::

- (Exam extra) At Brewster's angle, $\tan i_B = n$, the reflected light is fully polarised and the reflected and refracted rays are at $90^\circ$. For glass ($n = 1.5$), $i_B \approx 56^\circ$.

## NCERT lines to know

:::remember
- A wavefront is a surface of constant phase.
- Huygens' construction: the new wavefront is the **forward envelope** of the secondary wavelets.
- Young's double slit gives **equally spaced** fringes.
- A single slit of width $a$ gives zero intensity at $\theta = \pm\lambda/a, \pm 2\lambda/a, \dots$
- A polaroid transmits only the component of the electric field parallel to its pass axis.
:::
