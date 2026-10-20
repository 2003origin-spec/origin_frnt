---
title: "Oscillations: Short Notes"
type: short_notes
chapter: c11.physics.oscillations
order: 2
---

## 1. Periodic and oscillatory motion

- **Periodic motion:** a motion that repeats itself after a fixed interval of time. Examples: the Earth going round the Sun, the hands of a clock, uniform circular motion.
- **Oscillatory (vibratory) motion:** a periodic to-and-fro motion about a **mean position** (equilibrium position). Examples: a swinging pendulum, a mass on a spring, a boat bobbing on water.
- At the mean position the **net force is zero**. When the body is moved away, a force pulls it back.

:::remember
Every oscillatory motion is periodic, but not every periodic motion is oscillatory. Uniform circular motion repeats, but it does not move to and fro about a mean position.
:::

- When the frequency is small we call it oscillation (a branch swaying). When it is high we usually call it vibration (a guitar string). Both follow the same physics.

## 2. Period, frequency and displacement

| Quantity | Meaning | SI unit |
| --- | --- | --- |
| Period $T$ | Least time after which the motion repeats | s |
| Frequency $\nu$ | Repetitions per second, $\nu = 1/T$ | Hz ($\text{s}^{-1}$) |
| Angular frequency $\omega$ | $\omega = 2\pi/T = 2\pi\nu$ | rad/s |

- **Displacement** here means the change from equilibrium of whatever quantity oscillates. It can be a distance, an angle (pendulum), a voltage or a pressure. It can be positive or negative.
- A **periodic function** repeats after $T$: $f(t) = f(t + T)$. The simplest ones are $\sin\omega t$ and $\cos\omega t$, with period $2\pi/\omega$.
- Any periodic function can be built by adding sine and cosine functions of different periods with suitable coefficients (NCERT states this; it is Fourier's idea).

## 3. Simple harmonic motion (SHM)

SHM is the simplest oscillation. NCERT defines it by the displacement:
$$x(t) = A\cos(\omega t + \phi)$$

| Term | Symbol | What it tells you |
| --- | --- | --- |
| Amplitude | $A$ | Largest displacement on either side (positive) |
| Phase | $\omega t + \phi$ | The state of motion (position and direction) at time $t$ |
| Phase constant | $\phi$ | The phase at $t = 0$; set by where the motion starts |
| Angular frequency | $\omega$ | How fast the phase grows |

- The particle moves between $x = -A$ and $x = +A$.
- Two SHMs with the same $A$ and $\omega$ but different $\phi$ are the same motion, just shifted in time.
- **The period of SHM does not depend on the amplitude.** This is why it is so useful (clocks).

:::example{title="Reading an SHM equation"}
$x = 0.2\cos(4\pi t + \pi/6)$ m. Amplitude $= 0.2$ m, $\omega = 4\pi$ rad/s, so $\nu = 2$ Hz and $T = 0.5$ s. Phase constant $= \pi/6$.
:::

## 4. SHM and uniform circular motion

- A particle P moves round a circle of radius $A$ at constant angular speed $\omega$. Drop a perpendicular from P onto a diameter (the $x$-axis). The foot of the perpendicular, P′, does **SHM** with amplitude $A$ and angular frequency $\omega$.
- If OP makes angle $\phi$ with the $x$-axis at $t = 0$, it makes $\omega t + \phi$ at time $t$, so $x = A\cos(\omega t + \phi)$.
- This is why $\omega$ is called the **angular** frequency, and why the phase is an angle.

:::remember
SHM is the projection of uniform circular motion on a diameter of the circle. The circular motion itself is **not** SHM.
:::

## 5. Velocity and acceleration in SHM

- The reference particle P has speed $\omega A$ along the tangent. Its projection on the $x$-axis gives
$$v = -\omega A\sin(\omega t + \phi)$$
- P has centripetal acceleration $\omega^2 A$ towards the centre. Its projection gives
$$a = -\omega^2 A\cos(\omega t + \phi)$$
$$a = -\omega^2 x$$

| Position | Displacement | Speed | Acceleration |
| --- | --- | --- | --- |
| Mean ($x = 0$) | 0 | Largest, $\omega A$ | 0 |
| Extreme ($x = \pm A$) | Largest, $A$ | 0 | Largest, $\omega^2 A$ |

- The acceleration always points **towards the mean position** and is proportional to the displacement.
- Phase order: $v$ is ahead of $x$ by $\pi/2$, and $a$ is ahead of $x$ by $\pi$ (exactly opposite).
- Graphs of $x$, $v$, $a$ against $t$ are all sine/cosine curves with the same period $T$.

## 6. Force law for SHM

Newton's second law with $a = -\omega^2 x$ gives
$$F = ma = -m\omega^2 x$$
$$F = -kx$$

- $k = m\omega^2$ is the **force constant** (N/m). So $\omega = \sqrt{k/m}$.
- A force proportional to the displacement and opposite to it gives SHM. A system with such a force is a **linear harmonic oscillator**.
- **Mass on a spring** (smooth floor, massless spring): pull the block by $x$, the spring pulls back with $F = -kx$ (Hooke's law). So
$$T = 2\pi\sqrt{\frac{m}{k}}$$
- A heavier block oscillates more slowly; a stiffer spring oscillates faster.
- **Block between two identical springs** (NCERT Example 13.6): moving it by $x$ stretches one spring and compresses the other, and both pull it back. So $F = -2kx$ and $T = 2\pi\sqrt{m/2k}$.

:::tip
To test whether a motion is SHM, write the net force (or acceleration) in terms of the displacement. If it comes out as $-(\text{positive constant}) \times x$, it is SHM, and $\omega^2$ is that constant divided by $m$.
:::

## 7. Energy in SHM

- **Kinetic energy:** $K = \tfrac12 mv^2 = \tfrac12 kA^2\sin^2(\omega t + \phi)$.
- **Potential energy:** $U = \tfrac12 kx^2 = \tfrac12 kA^2\cos^2(\omega t + \phi)$, with $U = 0$ at the mean position.
- **Total energy:** $E = K + U = \tfrac12 kA^2$, constant in time.
- Energy keeps changing form: all kinetic at the mean position, all potential at the extremes.
- $K$ and $U$ are each periodic with period $T/2$ (they repeat twice per oscillation).
- Plotted against $x$, $U$ is an upward parabola, $K$ is a downward parabola, and $E$ is a flat line. They cross where $K = U$, at $x = \pm A/\sqrt2$.

## 8. The simple pendulum

A small heavy bob of mass $m$ hangs from a light, inextensible string of length $L$ fixed at the top.

- Pull the bob aside by angle $\theta$. The weight $mg$ splits into $mg\cos\theta$ along the string and $mg\sin\theta$ along the arc. The tension is **not** equal to $mg\cos\theta$ while the bob moves: $T - mg\cos\theta$ provides the centripetal force. Only $mg\sin\theta$ gives a torque about the support.
- The torque about the support is $\tau = -L\,(mg\sin\theta)$. The minus sign means it pulls the bob back.
- With $I = mL^2$ and $\tau = I\alpha$:
$$\alpha = -\frac{mgL}{I}\sin\theta$$
- For **small** $\theta$ (in radians), $\sin\theta \approx \theta$. NCERT's Table 13.1 shows that $\sin\theta$ stays nearly equal to $\theta$ up to about $20^\circ$. Then $\alpha = -\dfrac{g}{L}\theta$, which is SHM with
$$\omega = \sqrt{\frac{g}{L}}$$
$$T = 2\pi\sqrt{\frac{L}{g}}$$

| $T$ depends on | $T$ does not depend on |
| --- | --- |
| Length $L$ ($T \propto \sqrt L$) | Mass of the bob |
| $g$ ($T \propto 1/\sqrt g$) | Amplitude (if small) |

- For large angles the motion is still periodic, but **not** SHM. (Exam extra: the true period is then a little larger than $2\pi\sqrt{L/g}$.)
- **Seconds pendulum** (NCERT Example 13.8): $T = 2$ s, so $L = gT^2/4\pi^2 \approx 1$ m.
