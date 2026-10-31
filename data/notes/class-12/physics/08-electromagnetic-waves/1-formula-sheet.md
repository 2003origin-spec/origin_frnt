---
title: "Electromagnetic Waves: Formula Sheet"
type: formula_sheet
chapter: c12.physics.electromagnetic-waves
order: 1
---

Constants (NCERT values): $c = 3 \times 10^8$ m/s, $\mu_0 = 4\pi \times 10^{-7}$ T m A⁻¹, $\varepsilon_0 = 8.854 \times 10^{-12}$ C² N⁻¹ m⁻².

## Displacement current

:::formula{title="Displacement current"}
$$i_d = \varepsilon_0 \frac{d\Phi_E}{dt}$$
$i_d$ = displacement current (A), $\Phi_E$ = electric flux through the surface (V m, same as N m² C⁻¹), $t$ = time (s). It exists wherever the electric field **changes with time**. It is not a flow of charge. If $\vec E$ is steady, $i_d = 0$.
:::

:::formula{title="Flux between capacitor plates"}
$$\Phi_E = EA = \frac{Q}{\varepsilon_0}$$
Uniform field $E = \dfrac{Q}{\varepsilon_0 A}$ between plates of area $A$ carrying charge $Q$; edge effects ignored.
:::

:::formula{title="Uniform changing field over area A"}
$$i_d = \varepsilon_0 A\,\frac{dE}{dt}$$
Use when $\vec E$ is the same over the area $A$ and normal to it (as between the plates of a parallel-plate capacitor).
:::

:::formula{title="Charging (or discharging) capacitor"}
$$i_d = \frac{dQ}{dt} = C\,\frac{dV}{dt}$$
Between the plates there is **only** displacement current; in the wires there is **only** conduction current $i_c$. The two are equal: $i_d = i_c$. $C$ = capacitance (F), $V$ = p.d. between the plates (V).
:::

:::formula{title="Total current"}
$$i = i_c + i_d$$
$i_c$ = conduction current (moving charges). $i_d$ acts as a source of magnetic field exactly like $i_c$.
:::

:::formula{title="Ampere–Maxwell law"}
$$\begin{aligned} \oint \vec B\cdot d\vec l &= \mu_0 i_c \\ &\quad + \mu_0\varepsilon_0\frac{d\Phi_E}{dt} \end{aligned}$$
$i_c$ and $\Phi_E$ are for **any** surface whose rim is the closed loop. The answer for $\vec B$ is the same whichever surface you choose.
:::

:::formula{title="B between circular capacitor plates"}
Plates of radius $R$, displacement current $i_d$ (uniform over the plates), point at distance $r$ from the axis, in the gap.

Inside ($r \le R$):
$$B = \frac{\mu_0 i_d\, r}{2\pi R^2}$$
Outside ($r \ge R$):
$$B = \frac{\mu_0 i_d}{2\pi r}$$
$B$ is largest at $r = R$ and zero on the axis. Same method as NCERT Exercise 8.2. Edge effects ignored.
:::

## Maxwell's equations (vacuum)

:::formula{title="The four equations"}
Gauss's law for electricity:
$$\oint \vec E\cdot d\vec A = \frac{Q}{\varepsilon_0}$$
Gauss's law for magnetism:
$$\oint \vec B\cdot d\vec A = 0$$
Faraday's law:
$$\oint \vec E\cdot d\vec l = -\frac{d\Phi_B}{dt}$$
Ampere–Maxwell law:
$$\begin{aligned} \oint \vec B\cdot d\vec l &= \mu_0 i_c \\ &\quad + \mu_0\varepsilon_0\frac{d\Phi_E}{dt} \end{aligned}$$
The zero in the second law reflects that no magnetic monopoles (isolated magnetic poles) are known.
:::

## The plane EM wave

:::formula{title="Fields of a wave moving along +z"}
$$E_x = E_0 \sin(kz - \omega t)$$
$$B_y = B_0 \sin(kz - \omega t)$$
$E_0$ (V/m) and $B_0$ (T) are the amplitudes. $\vec E$, $\vec B$ and the direction of travel are all perpendicular to each other. $\vec E$ and $\vec B$ are **in phase**. A sign $(kz + \omega t)$ means travel along $-z$.
:::

:::formula{title="Wave number and angular frequency"}
$$k = \frac{2\pi}{\lambda}$$
$$\omega = 2\pi\nu$$
$k$ (rad/m) is the size of the wave vector $\vec k$, which points along the direction of travel. Wave speed $= \dfrac{\omega}{k}$.
:::

:::formula{title="Other forms of the same wave"}
$$E = E_0 \sin 2\pi\left(\frac{z}{\lambda} - \frac{t}{T}\right)$$
$T = 1/\nu$ = time period (s).
:::

:::formula{title="Speed in vacuum"}
$$c = \frac{1}{\sqrt{\mu_0\varepsilon_0}}$$
$$\omega = ck$$
$$c = \nu\lambda$$
$c = 3 \times 10^8$ m/s for **every** wavelength, from radio to gamma rays.
:::

:::formula{title="Field amplitudes"}
$$B_0 = \frac{E_0}{c}$$
For a plane wave in vacuum this also holds at every point and instant: $E = cB$. (In a medium, $E = vB$: exam extra.) In SI units $E$ (V/m) is a much bigger number than $B$ (T); this does **not** mean the electric part carries more energy.
:::

:::formula{title="Direction of travel"}
$$\text{travel} \parallel \vec E \times \vec B$$
Given $\vec E$ and the direction of travel $\hat k$: $\vec B$ points along $\hat k \times \vec E$.
:::

:::formula{title="Speed in a medium"}
$$v = \frac{1}{\sqrt{\mu\varepsilon}}$$
$\mu$ = permeability, $\varepsilon$ = permittivity of the medium. With $\varepsilon = \varepsilon_r\varepsilon_0$ and $\mu = \mu_r\mu_0$ (exam extra: this form follows from Eq. 8.11 but is not written in NCERT):
$$n = \frac{c}{v} = \sqrt{\mu_r\varepsilon_r}$$
$n$ = refractive index. The frequency stays the same in the medium; the speed and the wavelength fall by the factor $n$.
:::

:::formula{title="Photon energy (used in NCERT Exercise 8.9)"}
$$E = h\nu = \frac{hc}{\lambda}$$
$h = 6.63 \times 10^{-34}$ J s. Shortcut (beyond the chapter text): $E\,(\text{eV}) \approx \dfrac{1240}{\lambda\,(\text{nm})}$.
:::

## Spectrum (NCERT Table 8.1)

| Type | Wavelength |
| --- | --- |
| Radio | > 0.1 m |
| Microwave | 0.1 m to 1 mm |
| Infrared | 1 mm to 700 nm |
| Visible | 700 nm to 400 nm |
| Ultraviolet | 400 nm to 1 nm |
| X-rays | 1 nm to $10^{-3}$ nm |
| Gamma rays | < $10^{-3}$ nm |

Frequency rises from top to bottom ($\nu = c/\lambda$). The boundaries are not sharp; neighbouring bands overlap. These are the Table 8.1 values. The NCERT text gives wider ranges for some bands: UV down to 0.6 nm, X-rays about 10 nm to $10^{-4}$ nm, gamma rays from about $10^{-10}$ m to below $10^{-14}$ m.

## Energy, intensity, pressure (exam extra)

These are not in the current NCERT text (only Exercise 8.10 touches energy density). They are often asked as "characteristics of EM waves", which both syllabi list.

:::formula{title="Energy densities"}
$$u_E = \tfrac12\varepsilon_0 E^2$$
$$u_B = \frac{B^2}{2\mu_0}$$
Units J/m³. In vacuum $u_E = u_B$ at every instant, so the energy is shared **equally**.
:::

:::formula{title="Average energy density"}
$$\langle u\rangle = \tfrac12\varepsilon_0 E_0^2 = \frac{B_0^2}{2\mu_0}$$
This is the total (electric + magnetic). With $E_{rms} = E_0/\sqrt2$: $\langle u\rangle = \varepsilon_0 E_{rms}^2$.
:::

:::formula{title="Intensity"}
$$I = \langle u\rangle\,c = \tfrac12\varepsilon_0 c E_0^2$$
$I$ = average power per unit area (W/m²). Point source of power $P$ radiating equally in all directions: $I = \dfrac{P}{4\pi r^2}$.
:::

:::formula{title="Momentum and radiation pressure"}
Energy $U$ falling normally on a surface delivers momentum
$$p = \frac{U}{c}$$
if fully absorbed, and $2U/c$ if fully reflected. Pressure (normal incidence):
$$p_{rad} = \frac{I}{c}$$
fully absorbed, and $2I/c$ fully reflected. Force on area $A$: $F = p_{rad}A$.
:::
