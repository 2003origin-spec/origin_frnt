---
title: "Oscillations: Important Points and Traps"
type: key_points
chapter: c11.physics.oscillations
order: 3
---

## Periodic motion and SHM

- Every oscillation is periodic. A periodic motion (like uniform circular motion) need not be an oscillation.
- Every SHM is periodic and oscillatory. But an oscillation need not be SHM: a pendulum at a **large** angle oscillates, but not in SHM.
- In SHM the period does **not** depend on the amplitude. If a question says "doubling the amplitude doubles the period", it is wrong for SHM.

:::trap
Amplitude is the distance from the mean position to **one** extreme, not the full path. If a particle moves between two points 10 cm apart, $A = 5$ cm.

In one full period the particle covers a distance of $4A$, but its displacement is zero.
:::

:::trap
$\omega$ in SHM is the **angular frequency** (rad/s), not the frequency. For $x = A\cos(10t)$, $\omega = 10$ rad/s, so $\nu = 10/2\pi \approx 1.6$ Hz, not 10 Hz.
:::

## Telling SHM from other motions

- $\sin\omega t$, $\cos\omega t$, $\sin\omega t + \cos\omega t$ and $3\sin\omega t + 4\cos\omega t$: **SHM** (same $\omega$ added together still gives SHM).
- $\sin\omega t + \sin 2\omega t$ or $\cos\omega t + \cos 3\omega t$: **periodic but not SHM** (different $\omega$ values). Here the period is $2\pi/\omega$, the smallest time after which **every** part repeats (the LCM of the separate periods). NCERT: such a sum is periodic only if one frequency is a whole-number multiple of the other.
- $\sin^3\omega t$: periodic (period $2\pi/\omega$) but not SHM.
- $e^{-\omega t}$, $1 + \omega t + \omega^2t^2$: **not periodic** at all.

:::trap
$\cos(\pi/4 - 2\omega t)$ is SHM, but its angular frequency is $2\omega$, so its period is $\pi/\omega$, not $2\pi/\omega$. Always read $\omega$ as the full coefficient of $t$.
:::

## Velocity and acceleration

:::remember
- At the **mean position**: speed largest ($\omega A$), acceleration zero, force zero.
- At the **extremes**: speed zero, acceleration largest ($\omega^2 A$), force largest ($kA$).
- Acceleration always points towards the mean position, so it is opposite to the displacement.
:::

:::trap
At the extreme position the velocity is zero, but the acceleration is **not** zero. It is at its largest there. Do not mix up "the particle stops" with "no force acts".
:::

- At the mean position the speed is largest, but the acceleration is zero. So zero acceleration does **not** mean zero speed.
- At $x = A/2$ the speed is $\dfrac{\sqrt3}{2}\,\omega A$, not $\dfrac{\omega A}{2}$. Speed does not fall in step with displacement.
- Graph of $v$ against $x$ is an ellipse; graph of $a$ against $x$ is a straight line of slope $-\omega^2$ through the origin.

:::tip
**Times to remember** (starting from the mean position): mean to $A/2$ takes $T/12$; $A/2$ to $A$ takes $T/6$; mean to extreme takes $T/4$. The motion is fastest near the middle, so the first half of the distance takes the least time.
:::

## Spring and energy

:::trap
$T = 2\pi\sqrt{m/k}$ for a spring does not contain $g$. The same spring and mass have the same period on the Moon, on a smooth slope or hanging vertically. Only the mean position moves when gravity acts.
:::

:::remember
- $E = \tfrac12 kA^2$: double the amplitude and the energy becomes **four** times.
- $K = U$ at $x = \pm \dfrac{A}{\sqrt2}$, not at $x = \pm \dfrac{A}{2}$.
- At $x = A/2$: $U = E/4$ and $K = 3E/4$.
- $K$ and $U$ oscillate with frequency $2\nu$ (period $T/2$). The total energy is constant.
:::

:::trap
$U = \tfrac12 kx^2$ uses the displacement from the **mean position**. (Exam extra) For a vertical spring, measure $x$ from the new resting position (where it hangs at rest), not from the unstretched length, when you use it for SHM energy.
:::

- (Exam extra) Cutting a spring into two equal halves makes each half **twice** as stiff ($2k$). Joining two identical springs end to end (series) halves the stiffness.

## Simple pendulum

:::trap
$T = 2\pi\sqrt{L/g}$ is correct only for **small** angles. At large angles $\sin\theta \approx \theta$ fails, the motion is not SHM, and the true period is a little larger.
:::

:::trap
$L$ is measured from the point of support to the **centre of the bob**, not to its top or bottom.
:::

- The period does **not** depend on the mass of the bob. A heavier bob of the same size swings with the same $T$.
- $T \propto \sqrt L$: make the length **four** times to double the period. A 21% longer string gives about a 10% longer period.
- $T \propto 1/\sqrt g$: on the Moon ($g$ about one-sixth) the period is about $\sqrt6 \approx 2.45$ times longer. A pendulum clock taken there runs slow.
- The tension in the string is largest at the lowest point and smallest at the extremes.
- (Exam extra) In a lift accelerating upward, $g_{eff} = g + a$ and the pendulum swings faster. In free fall it does not swing at all.
- A **seconds pendulum** (NCERT Example 13.8) has $T = 2$ s, so its length is about 1 m (0.99 m with $g = 9.8$ m/s²).

## Not in the current NCERT book

:::remember
Damped oscillations, forced oscillations and resonance were removed from the rationalised NCERT chapter (a couple of leftover lines still mention damping). The current NEET and JEE Main syllabus lists for Oscillations do not name them either. Study them only if your coaching material asks for them.
:::

## NCERT lines to know

:::remember
- SHM is the projection of uniform circular motion on a diameter of the circle.
- In SHM the force is proportional to the displacement and directed towards the mean position: $F = -kx$.
- The total mechanical energy of a particle in SHM is constant, $E = \tfrac12 kA^2$, when there is no friction.
- A simple pendulum does SHM only for small angular displacements.
:::
