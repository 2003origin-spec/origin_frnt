---
title: "Oscillations: Formula Sheet"
type: formula_sheet
chapter: c11.physics.oscillations
order: 1
---

All formulas below are for **ideal** oscillations: no friction or air drag, so the amplitude stays constant. Damped and forced oscillations are not in the current NCERT book.

## Period and frequency

:::formula{title="Frequency"}
$$\nu = \frac{1}{T}$$
$T$ = period, the smallest time after which the motion repeats (s). $\nu$ = frequency, oscillations per second (hertz, Hz). $1\text{ Hz} = 1\text{ s}^{-1}$.
:::

:::formula{title="Angular frequency"}
$$\omega = \frac{2\pi}{T}$$
$$\omega = 2\pi\nu$$
$\omega$ in rad/s. It comes from $x(t) = x(t + T)$: one period adds $2\pi$ to the phase.
:::

## Displacement in SHM

:::formula{title="Displacement (NCERT form)"}
$$x(t) = A\cos(\omega t + \phi)$$
$x$ = displacement from the mean position (m), $A$ = amplitude, the largest displacement (m, always positive), $(\omega t + \phi)$ = phase, $\phi$ = phase constant (phase angle) at $t = 0$.
:::

:::formula{title="Same motion, sine form"}
$$x = A\sin\omega t$$
This is $A\cos(\omega t - \pi/2)$, so $\phi = -\pi/2$. Use it when the particle **starts from the mean position** at $t = 0$ moving in $+x$. If it starts at $x = +A$, use $x = A\cos\omega t$ ($\phi = 0$).
:::

:::formula{title="Sum of a sine and a cosine (same ω)"}
$$a\sin\omega t + b\cos\omega t = R\sin(\omega t + \alpha)$$
$$R = \sqrt{a^2 + b^2}$$
$$\tan\alpha = \frac{b}{a}$$
Still SHM with the **same** $\omega$ and period. Example: $\sin\omega t + \cos\omega t$ is SHM with amplitude $\sqrt2$.
:::

## Velocity and acceleration

:::formula{title="Velocity"}
$$v(t) = -\omega A\sin(\omega t + \phi)$$
m/s. Velocity is ahead of displacement in phase by $\pi/2$.
:::

:::formula{title="Velocity at displacement x"}
$$v = \pm\,\omega\sqrt{A^2 - x^2}$$
Derived from the formulas above (or from energy). The sign depends on the direction of motion. Valid only for $|x| \le A$.
:::

:::formula{title="Acceleration"}
$$a(t) = -\omega^2 A\cos(\omega t + \phi)$$
$$a = -\omega^2 x$$
m/s². Always towards the mean position, and proportional to the displacement. $a$ and $x$ are out of phase by $\pi$.
:::

:::formula{title="Largest values"}
$$v_{max} = \omega A$$
$$a_{max} = \omega^2 A$$
$v_{max}$ at the mean position ($x = 0$). $a_{max}$ at the extreme positions ($x = \pm A$). Also $a_{max}/v_{max} = \omega$.
:::

## Force law for SHM

:::formula{title="Restoring force"}
$$F = -kx$$
$$k = m\omega^2$$
$k$ = force constant (N/m), $m$ = mass (kg). The force is proportional to the displacement and points towards the mean position. Any motion with this force law is SHM (a linear harmonic oscillator).
:::

:::formula{title="Mass on a spring"}
$$\omega = \sqrt{\frac{k}{m}}$$
$$T = 2\pi\sqrt{\frac{m}{k}}$$
$k$ = spring constant. Assumes a **massless** spring obeying Hooke's law (small stretch), and no friction. $T$ does **not** depend on the amplitude.
:::

## Energy in SHM

:::formula{title="Kinetic energy"}
$$K = \tfrac12 mv^2$$
$$K = \tfrac12 kA^2\sin^2(\omega t + \phi)$$
$$K = \tfrac12 k\,(A^2 - x^2)$$
J. Largest ($\tfrac12 kA^2$) at the mean position, zero at the extremes.
:::

:::formula{title="Potential energy"}
$$U = \tfrac12 kx^2$$
$$U = \tfrac12 kA^2\cos^2(\omega t + \phi)$$
J. Taken as zero at the mean position. Largest at the extremes.
:::

:::formula{title="Total energy"}
$$E = K + U$$
$$E = \tfrac12 kA^2$$
$$E = \tfrac12 m\omega^2 A^2$$
Constant in time (no friction). $E \propto A^2$. $E \propto \omega^2$ only when the mass $m$ and amplitude $A$ stay the same (for a given spring, $E = \tfrac12 kA^2$ does not depend on $m$).
:::

:::formula{title="Period of K and U"}
$$T_{energy} = \frac{T}{2}$$
$K$ and $U$ repeat twice in each oscillation, so their frequency is $2\nu$. The total $E$ does not change at all.
:::

## Simple pendulum

:::formula{title="Restoring torque"}
$$\tau = -mgL\sin\theta$$
$$I = mL^2$$
$L$ = length from the point of support to the **centre of the bob** (m), $\theta$ = angle with the vertical. Only $mg\sin\theta$ (the tangential part of the weight) gives a torque about the support.
:::

:::formula{title="Period of a simple pendulum"}
$$T = 2\pi\sqrt{\frac{L}{g}}$$
Holds only for **small angles** ($\theta$ in radians, $\sin\theta \approx \theta$; NCERT's table shows this is nearly true up to about $20^\circ$), a point bob, and a light, inextensible string. $T$ does not depend on the mass of the bob or on the (small) amplitude.
:::

:::formula{title="Seconds pendulum (NCERT Example 13.8)"}
$$L = \frac{gT^2}{4\pi^2}$$
A seconds pendulum has $T = 2$ s (1 s each way), so $L = g/\pi^2$. With $g = 9.8$ m/s², $L \approx 0.99$ m, which NCERT rounds to 1 m.
:::

## Block between two springs (NCERT Example 13.6)

:::formula{title="Two identical springs, one on each side"}
$$F = -2kx$$
$$T = 2\pi\sqrt{\frac{m}{2k}}$$
A block of mass $m$ on a smooth floor, joined to two identical springs (constant $k$) fixed to walls on either side. Move it by $x$: one spring stretches and the other compresses by $x$, and **both** pull it back, so the effective constant is $2k$.
:::

## Exam extras (not in the NCERT chapter)

:::formula{title="Springs in parallel"}
$$k_{eq} = k_1 + k_2$$
The general rule behind NCERT Example 13.6: springs that stretch or compress by the **same** $x$ add their constants.
:::

:::formula{title="Springs in series"}
$$\frac{1}{k_{eq}} = \frac{1}{k_1} + \frac{1}{k_2}$$
Two identical springs in series: $k_{eq} = k/2$. Cutting a spring: $k \times \text{length}$ stays constant, so half a spring has $2k$.
:::

:::formula{title="Vertical spring"}
$$x_0 = \frac{mg}{k}$$
$$T = 2\pi\sqrt{\frac{x_0}{g}}$$
$x_0$ = stretch when the mass hangs at rest. It oscillates about this new mean position with the same $T = 2\pi\sqrt{m/k}$.
:::

:::formula{title="Pendulum in an accelerating lift"}
$$T = 2\pi\sqrt{\frac{L}{g_{eff}}}$$
Lift accelerating **up** at $a$: $g_{eff} = g + a$. Accelerating **down**: $g_{eff} = g - a$. Free fall: $g_{eff} = 0$, no oscillation.
:::

:::formula{title="Average energies over one period"}
$$\langle K \rangle = \langle U \rangle = \tfrac12 E$$
That is, each average is $\tfrac14 kA^2$. (Average over time, not over position.)
:::
