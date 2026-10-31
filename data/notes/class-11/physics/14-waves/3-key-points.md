---
title: "Waves: Important Points and Traps"
type: key_points
chapter: c11.physics.waves
order: 3
---

## Basics of a wave

- A wave carries **energy**, not matter. The particles of the medium only oscillate about their mean positions.
- **Medium decides the speed, source decides the frequency.** Going from one medium to another, $\nu$ stays the same, while $v$ and $\lambda$ change in the same ratio.
- Transverse waves can't travel through liquids or gases (no rigidity). Longitudinal waves can travel through all three states.

:::trap
**Particle velocity is not wave velocity.** In $y = a\sin(kx - \omega t)$ the wave moves at $v = \omega/k$ along $x$. Each particle moves along $y$, with a speed that keeps changing, up to $a\omega$. The two are different quantities, in different directions (for a transverse wave).
:::

:::trap
Read $k$ and $\omega$ from the equation **as written**. In $y = a\sin(\pi x - 50\pi t)$, $k = \pi$ rad/m, so $\lambda = 2\pi/k = 2$ m (not $\pi$ m). If the equation uses $\sin 2\pi(\dots)$, take the $2\pi$ in front into account.
:::

:::tip
**Direction from the signs:** if $x$ and $t$ have **opposite** signs inside the sine, the wave goes along $+x$; if they have the **same** sign, it goes along $-x$. So $a\sin(\omega t - kx)$ also travels along $+x$.
:::

- Phase difference $\Delta\phi = \dfrac{2\pi}{\lambda}\Delta x$. Points $\lambda$ apart are in phase; points $\lambda/2$ apart are in opposite phase.
- (Exam extra) For waves in the same medium, the energy carried is proportional to $a^2\nu^2$, the square of the amplitude times the square of the frequency.

## Speed of waves

:::trap
In $v = \sqrt{T/\mu}$, $T$ is the **tension**, not the period. And $\mu$ is mass per unit **length** in kg/m: a 20 g string 2 m long has $\mu = 0.02/2 = 0.01$ kg/m.
:::

- $v \propto \sqrt{T}$: making the tension 4 times **doubles** the speed.
- For a fixed $\nu$ on a string, $\lambda = v/\nu$, so a tighter string gives a longer wavelength.
- Sound in air at STP: Newton gave about 280 m/s, Laplace corrected it to about 331 m/s.

:::trap
Newton's mistake was the **isothermal** assumption, not the formula $v = \sqrt{B/\rho}$. That formula is right; the correct $B$ for sound in a gas is the **adiabatic** one, $\gamma P$.
:::

:::trap
Speed of sound in a gas does **not** depend on pressure (at constant temperature). Doubling $P$ also doubles $\rho$, so $P/\rho$ is unchanged. It **does** depend on temperature ($v \propto \sqrt T$, $T$ in K) and on humidity.
:::

- Gases at the same temperature: $v \propto \sqrt{\gamma/M}$. If $\gamma$ is the same (both diatomic), $v \propto 1/\sqrt M$. So sound is 4 times faster in $\text{H}_2$ ($M = 2$) than in $\text{O}_2$ ($M = 32$).
- Sound is usually fastest in solids and slowest in gases. This is only a general rule: NCERT's Table 14.1 lists vulcanised rubber at 54 m/s, slower than air (331 m/s at 0 °C).

## Superposition and reflection

- Displacements add **algebraically**, with signs. A crest meeting an equal trough gives zero displacement at that moment, but the waves are not destroyed; they move on unchanged.
- Two equal waves with phase difference $2\pi/3$ give amplitude $2a\cos 60^\circ = a$.

:::trap
At a **rigid** end the reflected wave is inverted (phase change $\pi$). At a **free** end it is not. A string tied to a wall is a rigid end; the closed end of a pipe is like a rigid end for the air.
:::

## Standing waves and normal modes

:::trap
Node-to-node distance is $\lambda/2$, **not** $\lambda$. Node-to-antinode is $\lambda/4$.
:::

- In a standing wave, all particles between two neighbouring nodes move **in phase**. Particles on opposite sides of a node move in **opposite phase**.
- Every particle (except nodes) does SHM with the same frequency, but the amplitude depends on the position: $|2a\sin kx|$.
- A string fixed at both ends in the $n$th harmonic has $n$ loops, $n + 1$ nodes (ends included) and $n$ antinodes.

:::remember
- String fixed at both ends and pipe open at both ends: **all** harmonics, $\nu_1 = v/2L$.
- Pipe closed at one end: **odd** harmonics only, $\nu_1 = v/4L$.
- A closed pipe's fundamental is **half** that of an open pipe of the same length.
:::

:::trap
**Overtone is not harmonic.** The 1st overtone is the next mode after the fundamental.
- String or open pipe: 1st overtone = **2nd** harmonic.
- Closed pipe: 1st overtone = **3rd** harmonic, 2nd overtone = 5th harmonic.
:::

:::tip
**"Closed is Odd"**: a pipe closed at one end has only odd harmonics (1, 3, 5, …) because one end must be a node and the other an antinode, so the pipe fits only odd numbers of $\lambda/4$.
:::

- In a pipe, a **displacement node** is a **pressure antinode**, and the other way round (NCERT text and Exercise 14.19). At the closed end the pressure varies the most; at an open end it hardly varies.
- (Exam extra) The real antinode at an open end is a little outside the pipe (end correction about $0.6r$). A resonance tube removes it by using $\lambda = 2(l_2 - l_1)$.

## Beats

:::trap
Beat frequency is $\nu_1 - \nu_2$, **not** half of it. Two forks of 256 Hz and 260 Hz give 4 beats per second.
:::

- One beat count gives two possible answers: a 5 Hz beat with a 320 Hz fork means the other is 315 Hz **or** 325 Hz. Use the second clue (a change in tension, loading or filing) to choose.
- Tightening a string **raises** its frequency (NCERT Example 14.6); loosening it lowers it.
- (Exam extra) Loading a tuning-fork prong with wax **lowers** its frequency; filing the free ends of the prongs **raises** it.
- (Exam extra) The ear can pick out beats only when the difference is small, roughly up to 10 Hz.

:::tip
**Choosing between two answers:** change the unknown frequency in the direction the clue says. If it moves **towards** the known frequency, the beats should **fall**; if it moves **away**, they should **rise**. Pick the value that matches what the question says happened.
:::

## NCERT lines to know

:::remember
- A wave transports energy, and the pattern of disturbance moves, without the medium as a whole moving.
- The speed of a mechanical wave is decided by the elastic and inertial properties of the medium.
- The phase changes by $\pi$ on reflection from a rigid boundary; there is no phase change at an open boundary.
- In a standing wave the positions of nodes and antinodes do not change with time.
- Beat frequency equals the difference of the two frequencies, $\nu_1 - \nu_2$.
:::
