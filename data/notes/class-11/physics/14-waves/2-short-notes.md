---
title: "Waves: Short Notes"
type: short_notes
chapter: c11.physics.waves
order: 2
---

## 1. What a wave is

A wave is a disturbance that moves through space and carries **energy** (and momentum) from one place to another. The medium itself does **not** travel along: each particle only oscillates about its mean position and passes the motion on to the next one.

Three kinds of waves (NCERT):
- **Mechanical waves:** need a material medium. Waves on a string, sound, water waves. This chapter is about these.
- **Electromagnetic waves:** need no medium; they travel through vacuum at the speed of light.
- **Matter waves:** waves linked with moving particles such as electrons (Class 12).

A mechanical wave needs a medium with **elasticity** (to pull particles back) and **inertia** (so they overshoot and keep oscillating).

## 2. Transverse and longitudinal waves

| | Transverse | Longitudinal |
| --- | --- | --- |
| Particles move | Perpendicular to the wave | Along the wave |
| Made of | Crests and troughs | Compressions and rarefactions |
| Medium needs | Shear (rigidity) | Bulk (volume) elasticity |
| Travel in | Solids, strings | Solids, liquids, gases |
| Example | Wave on a string | Sound in air |

- Fluids (liquids and gases) have no rigidity, so **transverse waves can't travel through them**. Sound in air is longitudinal.
- In a solid, both kinds can travel.
- Ripples on a water surface are neither purely transverse nor purely longitudinal: each water particle moves both up–down and back–forth.

## 3. The displacement relation

For a harmonic wave travelling along $+x$:
$$y(x,t) = a\sin(kx - \omega t + \phi)$$

| Term | Symbol | Meaning |
| --- | --- | --- |
| Amplitude | $a$ | Largest displacement of a particle |
| Phase | $kx - \omega t + \phi$ | Decides the displacement at $(x, t)$ |
| Wavelength | $\lambda$ | Distance between two nearest points in the same phase |
| Wave number | $k = 2\pi/\lambda$ | Phase change per metre |
| Period | $T$ | Time for one full oscillation of a particle |
| Frequency | $\nu = 1/T$ | Oscillations per second (Hz) |

- A crest is a point of largest positive displacement, a trough of largest negative displacement. Two neighbouring crests are $\lambda$ apart.
- **Sign rule:** $kx - \omega t$ means the wave travels along $+x$; $kx + \omega t$ means along $-x$.
- In a time $T$ the wave moves a distance $\lambda$, so $v = \lambda/T = \nu\lambda = \omega/k$.

## 4. Speed of a travelling wave

The speed of a mechanical wave depends on the **medium** (its elasticity and its inertia, i.e. density), not on the source. The **frequency** is set by the **source**. When a wave passes into a new medium, its frequency stays the same; its speed and wavelength change.

**Wave on a string:** $v = \sqrt{T/\mu}$. Tighter string means faster wave; heavier string means slower wave. NCERT gets this by dimensional analysis.

**Sound (longitudinal) in a fluid:** $v = \sqrt{B/\rho}$. In a thin solid bar: $v = \sqrt{Y/\rho}$.

Sound is generally fastest in solids, slower in liquids and slowest in gases. Solids and liquids are far harder to compress, and this outweighs their higher density.

**Newton and Laplace (sound in a gas):**
- Newton assumed the temperature stays constant (isothermal), so $B = P$ and $v = \sqrt{P/\rho}$. For air at STP this gives about **280 m/s**, much less than the measured 331 m/s.
- Laplace pointed out that compressions and rarefactions happen so fast that heat can't flow: the process is **adiabatic**, so $B = \gamma P$ and $v = \sqrt{\gamma P/\rho}$.
- With $\gamma = 1.4$ for air, $v \approx 331.3$ m/s at STP, which matches experiment.

:::remember
From $v = \sqrt{\gamma P/\rho}$ (NCERT exercises):
- At a fixed temperature, changing the pressure does **not** change $v$, because $P/\rho$ stays the same.
- $v$ **rises with temperature**: $v \propto \sqrt T$ ($T$ in kelvin).
- $v$ **rises with humidity**: moist air is less dense than dry air at the same pressure and temperature.
:::

## 5. Principle of superposition

When two or more waves overlap, the net displacement at any point is the **algebraic sum** of the displacements due to each wave:
$$y = y_1 + y_2 + \dots$$

- After they pass through each other, each wave goes on with its own shape, as if nothing had happened.
- Two equal waves (amplitude $a$) with phase difference $\phi$ give a wave of amplitude $2a\cos(\phi/2)$ (as a magnitude).
- In phase ($\phi = 0$): amplitude $2a$, **constructive interference**.
- Opposite phase ($\phi = \pi$): amplitude 0, **destructive interference**.

## 6. Reflection of waves

When a wave meets a boundary, part or all of it comes back.

- **Rigid (fixed) boundary**, e.g. a string tied to a wall: the end can't move, so the reflected wave has a **phase change of $\pi$**. A crest returns as a trough (the pulse is inverted).
- **Open (free) boundary**, e.g. a string end free to slide on a rod: **no phase change**. A crest returns as a crest.
- At a boundary between two media, part is reflected and part is transmitted (refracted). The transmitted and reflected waves keep the frequency of the incident wave.

## 7. Standing waves

A wave and its reflection, of the same amplitude and frequency, travelling in **opposite** directions, add to give a standing wave:
$$y = 2a\sin kx\,\cos\omega t$$

- **Nodes:** points that never move (amplitude zero). **Antinodes:** points of largest amplitude ($2a$).
- Neighbouring nodes are $\lambda/2$ apart; a node and the next antinode are $\lambda/4$ apart.
- The pattern does not move, so no net energy flows along it.

| | Progressive wave | Standing wave |
| --- | --- | --- |
| Pattern | Moves | Stays in place |
| Amplitude | Same everywhere | 0 at nodes, $2a$ at antinodes |
| Energy | Carried forward | Not carried along |
| Phase | Changes point to point | Same between two nodes |

## 8. Normal modes

A bounded system (a string fixed at both ends, an air column in a pipe) can hold standing waves only at certain frequencies, its **normal modes**. The lowest is the **fundamental mode** (first harmonic).

| System | Ends | Frequencies |
| --- | --- | --- |
| String fixed at both ends | Node, node | $n\,v/2L$, all $n$ |
| Pipe closed at one end | Node, antinode | $v/4L, 3v/4L, \dots$ (odd only) |
| Pipe open at both ends | Antinode, antinode | $n\,v/2L$, all $n$ |

In a pipe, "node" and "antinode" here mean **displacement** nodes and antinodes. At the closed end the air can't move (node); at an open end it moves most (antinode). NCERT adds: at a displacement node the **pressure** changes are the largest, and at a displacement antinode they are the least.

:::example{title="NCERT-type check: open or closed pipe?"}
A 30 cm pipe, $v = 330$ m/s. Open at both ends: fundamental $= 330/0.6 = 550$ Hz, so 1100 Hz is its **2nd harmonic**. Closed at one end: fundamental $= 330/1.2 = 275$ Hz, and only odd harmonics (275, 825, 1375 Hz …) are allowed, so 1100 Hz is **not** possible.
:::

## 9. Beats

When two sound waves of **slightly different** frequencies $\nu_1$ and $\nu_2$ sound together, the loudness rises and falls regularly. One rise and fall is one **beat**.

- Beat frequency $= \nu_1 - \nu_2$ (larger minus smaller).
- The note you hear has the **average** frequency $(\nu_1 + \nu_2)/2$.
- Musicians use beats to tune instruments: they adjust the string until the beats stop ($\nu_1 = \nu_2$).

:::remember
The Doppler effect is not in the current NCERT book. It is also not listed in the official JEE Main 2026 (NTA) or NEET UG 2026 (NMC) physics syllabus, so it is not covered here. Check the syllabus for your exam year.
:::
