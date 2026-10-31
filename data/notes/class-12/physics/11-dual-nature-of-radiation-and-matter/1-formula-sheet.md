---
title: "Dual Nature: Formula Sheet"
type: formula_sheet
chapter: c12.physics.dual-nature-of-radiation-and-matter
order: 1
---

NCERT values used here: $h = 6.63 \times 10^{-34}$ J s, $c = 3 \times 10^8$ m/s, $e = 1.6 \times 10^{-19}$ C, $m_e = 9.11 \times 10^{-31}$ kg.

## Energy unit

:::formula{title="Electron volt"}
$$1\ \text{eV} = 1.602 \times 10^{-19}\ \text{J}$$
The energy an electron gains when it is accelerated through a potential difference of 1 V. Most questions round it to $1.6 \times 10^{-19}$ J. Convert eV to joules before using SI formulas.
:::

## Photons

:::formula{title="Energy of a photon"}
$$E = h\nu$$
$$E = \frac{hc}{\lambda}$$
$h$ = Planck's constant (J s), $\nu$ = frequency (Hz), $\lambda$ = wavelength (m), $E$ in J. It depends only on $\nu$ (or $\lambda$), never on the intensity.
:::

:::formula{title="Quick form in eV and nm (a shortcut, not in NCERT)"}
$$E\ (\text{eV}) \approx \frac{1240}{\lambda\ (\text{nm})}$$
Comes from $hc \approx 1.99 \times 10^{-25}$ J m. With NCERT's rounded values ($e = 1.6 \times 10^{-19}$ C) this is about 1243 eV nm; 1240 uses more exact constants. The difference (under 0.3%) does not matter in MCQs. A 500 nm photon has about 2.5 eV.
:::

:::formula{title="Momentum of a photon"}
$$p = \frac{h\nu}{c} = \frac{h}{\lambda}$$
$$p = \frac{E}{c}$$
$p$ in kg m/s. A photon always moves at speed $c$ (in vacuum).
:::

:::formula{title="Photons per second from a source"}
$$N = \frac{P}{E} = \frac{P\lambda}{hc}$$
$P$ = power of the beam (W), $N$ = photons emitted (or arriving) per second. For one wavelength (monochromatic light) only.
:::

## Photoelectric effect

:::formula{title="Stopping potential and maximum kinetic energy"}
$$K_{max} = eV_0$$
$$K_{max} = \tfrac12 m v_{max}^2$$
$V_0$ = stopping (cut-off) potential, the size of the negative collector potential that just makes the photocurrent zero. $K_{max}$ in eV is numerically equal to $V_0$ in volts.
:::

:::formula{title="Einstein's photoelectric equation"}
$$K_{max} = h\nu - \phi_0$$
$\phi_0$ = work function of the metal (J or eV). Holds only when $h\nu \ge \phi_0$. Other electrons come out with **less** than $K_{max}$.
:::

:::formula{title="Threshold frequency and wavelength"}
$$\nu_0 = \frac{\phi_0}{h}$$
$$\lambda_0 = \frac{hc}{\phi_0}$$
Emission needs $\nu \ge \nu_0$, that is $\lambda \le \lambda_0$. $\nu_0$ is the **lowest** frequency, $\lambda_0$ the **longest** wavelength, that can eject electrons.
:::

:::formula{title="Other forms of Einstein's equation"}
$$eV_0 = h(\nu - \nu_0)$$
$$eV_0 = \frac{hc}{\lambda} - \frac{hc}{\lambda_0}$$
Same equation, using $\phi_0 = h\nu_0 = hc/\lambda_0$.
:::

:::formula{title="Stopping potential against frequency"}
$$V_0 = \frac{h}{e}\,\nu - \frac{\phi_0}{e}$$
A straight line. Slope $= h/e$, the **same for every metal**. It cuts the $\nu$-axis at $\nu_0$. Extended back, it cuts the $V_0$-axis at $-\phi_0/e$. Valid for $\nu \ge \nu_0$.
:::

:::formula{title="Maximum speed of photoelectrons"}
$$v_{max} = \sqrt{\frac{2eV_0}{m}}$$
$m$ = mass of the electron. Use SI units ($V_0$ in V, $e$ in C).
:::

## Matter waves

:::formula{title="de Broglie relation"}
$$\lambda = \frac{h}{p} = \frac{h}{mv}$$
$m$ = mass, $v$ = speed of the particle, $p$ = its momentum. The same relation gives the right wavelength for a photon. It depends only on the momentum, not on the charge or the kind of particle.
:::

:::formula{title="In terms of kinetic energy (exam extra, not in current NCERT)"}
$$\lambda = \frac{h}{\sqrt{2mK}}$$
From $K = p^2/2m$. Holds while $v \ll c$ (non-relativistic).
:::

:::formula{title="Charged particle accelerated from rest (exam extra, not in current NCERT)"}
$$\lambda = \frac{h}{\sqrt{2mqV}}$$
$q$ = charge, $V$ = accelerating potential difference, so $K = qV$. For an electron:
$$\lambda = \frac{1.227}{\sqrt V}\ \text{nm}$$
with $V$ in volts. Non-relativistic: fine for a few kV, not near 100 kV and above.
:::

:::formula{title="Particle in thermal equilibrium (exam extra, not in current NCERT)"}
$$\lambda = \frac{h}{\sqrt{3mk_BT}}$$
Uses the average translational kinetic energy $\tfrac32 k_BT$ of a gas molecule at temperature $T$ (K), so it gives a typical (rms) wavelength, not one exact value. $k_B = 1.38 \times 10^{-23}$ J/K.
:::

## X-rays from fast electrons (NCERT Exercise 11.1)

:::formula{title="Shortest X-ray wavelength"}
$$\nu_{max} = \frac{eV}{h}$$
$$\lambda_{min} = \frac{hc}{eV}$$
$V$ = accelerating voltage of the electrons. The whole kinetic energy $eV$ of one electron goes into one photon at most.
:::

## Radiation force (exam extra, not in current NCERT)

:::formula{title="Force of a light beam on a surface"}
$$F = \frac{P}{c}$$
Not in the current NCERT books (the rationalised EM-waves chapter dropped radiation momentum), but it follows from photon momentum: $N = P/h\nu$ photons per second, each bringing $h\nu/c$. Beam of power $P$ falling **normally** and **fully absorbed**. If it is fully **reflected**, the momentum change doubles:
$$F = \frac{2P}{c}$$
:::

## Units and dimensions (NCERT table)

| Quantity | Symbol | Dimensions | SI unit |
| --- | --- | --- | --- |
| Planck's constant | $h$ | $[ML^2T^{-1}]$ | J s |
| Stopping potential | $V_0$ | $[ML^2T^{-3}A^{-1}]$ | V |
| Work function | $\phi_0$ | $[ML^2T^{-2}]$ | J, eV |
| Threshold frequency | $\nu_0$ | $[T^{-1}]$ | Hz |
| de Broglie wavelength | $\lambda$ | $[L]$ | m |
