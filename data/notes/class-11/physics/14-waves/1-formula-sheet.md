---
title: "Waves: Formula Sheet"
type: formula_sheet
chapter: c11.physics.waves
order: 1
---

All formulas are for **mechanical harmonic waves** with no loss of energy (the amplitude stays constant). The Doppler effect is not in the current NCERT book, and it is not listed in the official JEE Main 2026 (NTA) or NEET UG 2026 (NMC) physics syllabus, so it is left out.

## Describing a progressive wave

:::formula{title="Displacement relation (NCERT form)"}
$$y(x,t) = a\sin(kx - \omega t + \phi)$$
$y$ = displacement of the particle at position $x$ at time $t$ (m), $a$ = amplitude (m, always positive), $(kx - \omega t + \phi)$ = phase, $\phi$ = phase constant (phase at $x = 0$, $t = 0$). This wave travels along **+x**. With $(kx + \omega t + \phi)$ it travels along **−x**.
:::

:::formula{title="Angular wave number"}
$$k = \frac{2\pi}{\lambda}$$
$\lambda$ = wavelength, the least distance between two points in the same phase (m). $k$ in rad/m.
:::

:::formula{title="Angular frequency"}
$$\omega = \frac{2\pi}{T} = 2\pi\nu$$
$T$ = period (s), $\nu$ = frequency (Hz). Every particle of the medium oscillates with this same period.
:::

:::formula{title="Wave speed"}
$$v = \frac{\omega}{k} = \frac{\lambda}{T} = \nu\lambda$$
m/s. The wave moves one wavelength in one period. For a wave written as $a\sin(kx - \omega t)$, read $k$ and $\omega$ from the equation, then $v = \omega/k$.
:::

:::formula{title="Phase difference and path difference"}
$$\Delta\phi = \frac{2\pi}{\lambda}\,\Delta x$$
Between two points $\Delta x$ apart, at the same instant. For one point at two instants $\Delta t$ apart: $\Delta\phi = \dfrac{2\pi}{T}\,\Delta t$.
:::

:::formula{title="Particle velocity (exam extra, not in NCERT)"}
$$v_p = \frac{\partial y}{\partial t}$$
$$v_p = -a\omega\cos(kx - \omega t + \phi)$$
Largest particle speed $= a\omega$. This is the speed of a particle of the medium, **not** the wave speed $v = \omega/k$. For a wave moving along $+x$ you can also write $v_p = -v\,\dfrac{\partial y}{\partial x}$ (wave speed times the slope of the string, with a minus sign).
:::

## Speed of a wave

:::formula{title="Transverse wave on a stretched string"}
$$v = \sqrt{\frac{T}{\mu}}$$
$T$ = **tension** (N), not the period. $\mu$ = mass per unit length (kg/m) $= \dfrac{m}{L}$. Depends only on the string and its tension, not on the frequency.
:::

:::formula{title="Longitudinal wave in a fluid"}
$$v = \sqrt{\frac{B}{\rho}}$$
$B$ = bulk modulus (Pa), $\rho$ = density (kg/m³). Used for sound in liquids and gases.
:::

:::formula{title="Longitudinal wave in a solid bar"}
$$v = \sqrt{\frac{Y}{\rho}}$$
$Y$ = Young's modulus (Pa). Holds for a thin bar, where sideways bulging is negligible.
:::

:::formula{title="Newton's formula (isothermal, wrong)"}
$$v = \sqrt{\frac{P}{\rho}}$$
Newton took the compressions to be isothermal, so $B = P$. For air at STP this gives about **280 m/s**, about 15% less than the measured value.
:::

:::formula{title="Laplace correction (adiabatic, correct)"}
$$v = \sqrt{\frac{\gamma P}{\rho}}$$
The compressions are too fast for heat to flow, so they are adiabatic and $B = \gamma P$. For air $\gamma = 7/5$, giving about **331.3 m/s** at STP.
:::

:::formula{title="Sound in an ideal gas (follows from Laplace's formula)"}
$$v = \sqrt{\frac{\gamma RT}{M}}$$
Put $P/\rho = RT/M$ (ideal gas) into $v = \sqrt{\gamma P/\rho}$. $T$ = absolute temperature (K), $M$ = molar mass (kg/mol), $R = 8.314$ J mol⁻¹ K⁻¹. So $v \propto \sqrt T$, and at a fixed temperature $v$ does **not** depend on pressure.
:::

## Superposition

:::formula{title="Principle of superposition"}
$$y = y_1 + y_2$$
The net displacement is the **algebraic sum** of the displacements of the overlapping waves. Each wave moves on unchanged after they pass.
:::

:::formula{title="Two equal waves with a phase difference φ"}
$$y_1 = a\sin(kx - \omega t)$$
$$y_2 = a\sin(kx - \omega t + \phi)$$
$$y = A\sin\!\left(kx - \omega t + \frac{\phi}{2}\right)$$
$$A = 2a\cos\frac{\phi}{2}$$
Same $a$, $k$, $\omega$, same direction. The resultant amplitude is the size of $A$ (take it as positive): $2a$ when $\phi = 0, 2\pi, \dots$ (constructive), zero when $\phi = \pi, 3\pi, \dots$ (destructive).
:::

:::formula{title="Unequal amplitudes (exam extra)"}
$$A^2 = a_1^2 + a_2^2 + 2a_1a_2\cos\phi$$
Same $k$ and $\omega$. $A$ lies from $|a_1 - a_2|$ to $a_1 + a_2$.
:::

## Reflection

:::formula{title="Rigid boundary (fixed end)"}
$$y_r = a\sin(kx + \omega t + \pi)$$
For an incident wave $a\sin(kx - \omega t)$. Same as $-a\sin(kx + \omega t)$, the form in the NCERT Summary. Phase change of $\pi$: a crest comes back as a trough.
:::

:::formula{title="Open boundary (free end)"}
$$y_r = a\sin(kx + \omega t)$$
No phase change: a crest comes back as a crest.
:::

## Standing waves

:::formula{title="Standing wave (NCERT form)"}
$$y(x,t) = 2a\sin kx\,\cos\omega t$$
Sum of $a\sin(kx - \omega t)$ and $a\sin(kx + \omega t)$. Amplitude at position $x$ is $|2a\sin kx|$. It does not travel.
:::

:::formula{title="Nodes and antinodes"}
$$x_{node} = \frac{n\lambda}{2}$$
$$x_{antinode} = \left(n + \frac12\right)\frac{\lambda}{2}$$
Here $n = 0, 1, 2, \dots$, for the form $2a\sin kx\cos\omega t$ (node at $x = 0$). Node to next node $= \lambda/2$; node to next antinode $= \lambda/4$.
:::

:::formula{title="String fixed at both ends"}
$$\nu_n = \frac{n\,v}{2L}$$
Here $n = 1, 2, 3, \dots$. Nodes at both ends, so $L = n\lambda/2$. $n = 1$ is the fundamental (first harmonic). **All** harmonics are present.
:::

:::formula{title="String: frequency from tension"}
$$\nu_n = \frac{n}{2L}\sqrt{\frac{T}{\mu}}$$
$T$ = tension (N), $\mu$ = mass per unit length (kg/m).
:::

:::formula{title="Pipe closed at one end"}
$$\nu = \left(n + \frac12\right)\frac{v}{2L}$$
Here $n = 0, 1, 2, \dots$. Node at the closed end, antinode at the open end, so $L = \left(n + \frac12\right)\dfrac{\lambda}{2}$. Frequencies $\dfrac{v}{4L}, \dfrac{3v}{4L}, \dfrac{5v}{4L}, \dots$: **odd** harmonics only.
:::

:::formula{title="Pipe open at both ends"}
$$\nu_n = \frac{n\,v}{2L}$$
Here $n = 1, 2, 3, \dots$. Antinodes at both ends. **All** harmonics. Fundamental $v/2L$, twice that of a closed pipe of the same length.
:::

:::formula{title="End correction (exam extra, not in NCERT)"}
$$e \approx 0.6\,r$$
$r$ = inner radius of the pipe. Useful for the resonance-tube experiment, which is in the JEE Main and NEET experimental-skills list. The antinode forms a little outside the open end. Closed pipe: use $L + e$. Open pipe: use $L + 2e$. Resonance tube: $\lambda = 2(l_2 - l_1)$ for two neighbouring resonance lengths.
:::

## Beats

:::formula{title="Beat frequency"}
$$\nu_{beat} = \nu_1 - \nu_2$$
Take the larger minus the smaller ($\nu_1 > \nu_2$). Number of loud sounds per second. Two sources of slightly different frequency.
:::

:::formula{title="Resultant of two close frequencies (NCERT form)"}
$$s = 2a\cos\omega_b t\,\cos\omega_a t$$
$$\omega_b = \frac{\omega_1 - \omega_2}{2}$$
$$\omega_a = \frac{\omega_1 + \omega_2}{2}$$
Equal amplitudes $a$, and $\omega_1 - \omega_2$ much smaller than $\omega_1$ (so $\omega_a \gg \omega_b$). The sound has the average angular frequency $\omega_a$; its loudness rises and falls. $|\cos\omega_b t|$ peaks twice per cycle, so the beat frequency is $2 \times \dfrac{\omega_b}{2\pi} = \nu_1 - \nu_2$.
:::
