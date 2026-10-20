---
title: "Wave Optics: Short Notes"
type: short_notes
chapter: c12.physics.wave-optics
order: 2
---

## 1. Two models of light

- **Corpuscular model** (Descartes 1637, developed by Newton): light is made of particles. It predicted that light is **faster** in the denser medium, where it bends towards the normal.
- **Wave model** (Huygens 1678): light is a wave. It predicted that light is **slower** in the denser medium.
- Foucault (1850) found that light is slower in water than in air. The wave model was right.
- Young's double-slit experiment (1801) firmly showed that light is a wave.
- Maxwell showed light is an **electromagnetic wave**: changing electric and magnetic fields, which need no medium. This is why light travels through vacuum.
- **Geometrical (ray) optics** is the limit $\lambda \to 0$. Visible light has a very small wavelength (yellow light: about 0.6 µm), so it travels almost in straight lines past ordinary mirrors and lenses.

## 2. Wavefronts and Huygens principle

- **Wavefront:** a surface on which all points vibrate in the **same phase** (a surface of constant phase).
- **Rays** are perpendicular to the wavefronts when the speed of light is the same in every direction (as in glass, water or air). Energy travels along the rays.
- The speed with which the wavefront moves out is the speed of the wave.

| Source | Wavefront |
| --- | --- |
| Point source | Spherical (diverging) |
| Far-away source (a star) | Plane |
| Point source at the focus of a convex lens | Plane (after the lens) |
| Line source (exam extra) | Cylindrical |

**Huygens principle:**
- Every point on a wavefront is a source of **secondary wavelets**. They spread out in all directions with the speed of the wave.
- After time $t$, draw spheres of radius $vt$ from each point. The **forward envelope** (common tangent) of these spheres is the new wavefront.
- A **backwave** would also appear. Huygens removed it by assuming the wavelets are strongest forward and zero backward. NCERT calls this an ad hoc assumption; a more rigorous wave theory justifies it.

## 3. Refraction and reflection with Huygens

**Refraction at a denser medium** ($v_2 < v_1$):
- A plane wavefront AB hits the surface at angle $i$. While end B moves $BC = v_1t$, a wavelet from A grows to radius $AE = v_2t$.
- The tangent CE is the refracted wavefront. From triangles ABC and AEC:
$$\frac{\sin i}{\sin r} = \frac{v_1}{v_2}$$
- With $n = c/v$ this is Snell's law, $n_1\sin i = n_2\sin r$.
- $r < i$ means $v_2 < v_1$: light **slows down** in the denser medium.
- The wavelength also falls ($\lambda_1/\lambda_2 = v_1/v_2$), but the **frequency stays the same**.

**Refraction at a rarer medium** ($v_2 > v_1$): the wave bends **away** from the normal. Above the critical angle ($\sin i_c = n_2/n_1$) there is no refracted wave: total internal reflection.

**Reflection:** the wavelet from A grows to $AE = vt = BC$. Triangles EAC and BAC are congruent, so $i = r$ (law of reflection).

**Wavefronts through optical devices:**
- **Thin prism:** the part of the wave going through the thicker glass is delayed most, so the emerging wavefront is **tilted**.
- **Convex lens:** the centre is delayed most, so a plane wave becomes a **spherical wave converging** to the focus F.
- **Concave mirror:** a plane wave reflects into a spherical wave converging to F.

:::remember
The total time from a point on the object to the matching point on the image is the **same along every ray**. A ray through the thick centre of a lens has a shorter path but goes slower in glass.
:::

## 4. Coherent and incoherent sources

- **Superposition principle:** the resultant displacement at a point is the vector sum of the displacements due to each wave.
- **Coherent sources:** the phase difference between them at any point **does not change with time**. Then the pattern of bright and dark points stays fixed: **sustained interference**.
- With two equal coherent sources in phase, each giving intensity $I_0$:
  - path difference $n\lambda$: bright, $I = 4I_0$;
  - path difference $(n + \tfrac12)\lambda$: dark, $I = 0$;
  - any phase difference $\phi$: $I = 4I_0\cos^2(\phi/2)$.
- **Incoherent sources:** the phase difference changes very fast. Only the average is seen, $I = 2I_0$ everywhere, and there are no fringes.

| | Coherent | Incoherent |
| --- | --- | --- |
| Phase difference | Constant in time | Changes rapidly |
| What adds | Displacements | Intensities |
| Result | Fixed fringes | Uniform $2I_0$ |

**Conditions for sustained interference** (NCERT summary): the sources must have the **same frequency** and a **stable phase difference**. Equal (or nearly equal) amplitudes give dark fringes that are really dark.

## 5. Young's double-slit experiment

- **Why two lamps fail:** an ordinary source (like a sodium lamp) changes phase abruptly about every $10^{-10}$ s. Two lamps are therefore incoherent: no fringes.
- **Young's trick:** light from **one** source S falls on two close pinholes $S_1$ and $S_2$. Any phase jump in S reaches both equally, so $S_1$ and $S_2$ are **locked in phase** (coherent).
- At a point P at distance $x$ from the centre O, the path difference is $xd/D$.
- Bright fringes at $x = n\lambda D/d$; dark fringes at $x = (n + \tfrac12)\lambda D/d$. The centre is bright.
- Bright and dark fringes are **equally spaced**, with fringe width $\beta = \lambda D/d$.

| Change | Fringe width $\beta$ |
| --- | --- |
| Larger $\lambda$ (red, not blue) | Increases |
| Screen moved away (larger $D$) | Increases |
| Slits closer (smaller $d$) | Increases |
| Set-up dipped in water | Decreases ($\beta/n$) |

:::example{title="Fringe width"}
$\lambda = 600$ nm, $d = 0.3$ mm, $D = 1.5$ m. Then $\beta = \dfrac{600 \times 10^{-9} \times 1.5}{0.3 \times 10^{-3}} = 3 \times 10^{-3}$ m $= 3$ mm.
:::

**White light** (exam extra): the central fringe is white (path difference zero for every colour). The fringes on either side are coloured, and a few fringes away the colours overlap into uniform light.

## 6. Diffraction

- **Diffraction:** light bending around the edges of an obstacle or slit into the region of geometrical shadow. All waves show it (sound, light, water, matter waves).
- It is rarely noticed for light because $\lambda$ is very small compared to most obstacles.
- Diffraction **limits the resolution** of the eye, telescopes and microscopes. The colours seen on a CD are also a diffraction effect.

**Single slit** of width $a$, parallel light falling normally:
- The slit is split into many small parts. Each acts as a secondary source, all **in phase**, and their waves are added at each point P on the screen.
- **Central maximum** at $\theta = 0$: broad and brightest.
- **Minima** at $\theta \approx n\lambda/a$, $n = \pm 1, \pm 2, \dots$
- **Secondary maxima** at $\theta \approx (n + \tfrac12)\lambda/a$, getting weaker and weaker.
- Angular width of the central maximum $= 2\lambda/a$. A **narrower** slit gives a **wider** central maximum.

**Interference vs diffraction** (Feynman, quoted in NCERT): there is no real physical difference. With a few sources we usually say interference; with a very large number, diffraction. The double-slit pattern is really the double-slit interference pattern combined with the single-slit diffraction of each slit.

| | YDSE fringes | Single-slit pattern |
| --- | --- | --- |
| Width | All equal | Central one is double |
| Brightness | All (nearly) equal | Falls off fast |
| Sources | Two | Many points of one slit |

**Seeing it at home (NCERT):** hold two razor blades with a narrow slit between them and look at a straight bulb filament. Red fringes look wider than blue ones. Never look at the Sun.

:::remember
In interference and diffraction, light energy is only **redistributed**. Dark fringes lose energy and bright fringes gain it; energy is conserved.
:::

## 7. Polarisation

- A wave on a string, $y = a\sin(kx - \omega t)$, has its displacement **perpendicular** to the direction of travel: a **transverse** wave.
- If the string always vibrates in one plane (the x-y plane), the wave is **linearly polarised** or **plane polarised** (here, $y$-polarised).
- If the plane of vibration changes randomly in very short times, the wave is **unpolarised**. The displacement is still perpendicular to the direction of travel.
- **Light is transverse:** its electric field is always perpendicular to the direction of travel. Natural light (from the Sun or a sodium lamp) is unpolarised.

**Polaroid:**
- A sheet of long-chain molecules aligned in one direction.
- The electric field **along** the molecules is absorbed. The field **perpendicular** to the molecules passes: this direction is the **pass axis**.
- Unpolarised light through one polaroid: intensity becomes **half**, whatever the angle of the polaroid.
- Two polaroids: $I = I_0\cos^2\theta$ (**Malus' law**). Crossed polaroids ($\theta = 90^\circ$) let nothing through.
- Rotating the second polaroid through a full turn ($2\pi$) gives **two maxima and two minima**.

**Uses of polaroids:** to control intensity in sunglasses and windowpanes, in photographic cameras and in 3D movie cameras.

**Brewster's law (exam extra: in the JEE Main and NEET syllabi, not in NCERT):** when unpolarised light falls on a transparent surface at the angle $i_B$ with $\tan i_B = n$, the reflected light is completely plane polarised (electric field perpendicular to the plane of incidence). At this angle the reflected and refracted rays are perpendicular.

:::tip
Polarisation shows that light is **transverse**. Interference and diffraction happen even with longitudinal waves like sound, but polarisation is special to transverse waves. Sound in air cannot be polarised.
:::
