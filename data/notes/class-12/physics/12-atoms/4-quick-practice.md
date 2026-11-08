---
title: "Atoms (Physics): Quick Practice"
type: practice
chapter: c12.physics.atoms
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise (no question here needs it). Use NCERT values: $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^9$ N m²/C², $e = 1.6 \times 10^{-19}$ C, $h = 6.6 \times 10^{-34}$ J s, and $hc = 1240$ eV nm where a question says so.

## Alpha-particle scattering

:::question{title="1. Closest approach" exam="NEET level"}
An α-particle with kinetic energy 7.2 MeV moves head-on towards a nucleus with $Z = 80$. Find the distance of closest approach.

---

$K = 7.2 \times 10^6 \times 1.6 \times 10^{-19} = 1.152 \times 10^{-12}$ J.

$\dfrac{e^2}{4\pi\varepsilon_0} = 9 \times 10^9 \times (1.6 \times 10^{-19})^2$, which is $2.304 \times 10^{-28}$ J m.

$d = \dfrac{2Ze^2}{4\pi\varepsilon_0 K} = \dfrac{160 \times 2.304 \times 10^{-28}}{1.152 \times 10^{-12}}$

$d =$ **3.2 × 10⁻¹⁴ m (32 fm)**.
:::

:::question{title="2. Alpha or proton" exam="NEET level"}
An α-particle and a proton with the **same** kinetic energy are each fired head-on at the same gold nucleus. Find the ratio of their distances of closest approach, $d_\alpha : d_p$.

---

$d = \dfrac{q\,(Ze)}{4\pi\varepsilon_0 K}$, so for the same $K$ and the same nucleus, $d \propto q$. The α-particle has charge $2e$, the proton $e$. So $d_\alpha : d_p =$ **2 : 1**.
:::

## Bohr model

:::question{title="3. Energies in n = 2" exam="NEET level"}
For a hydrogen atom in its first excited state, find the total energy, kinetic energy and potential energy of the electron.

---

First excited state is $n = 2$: $E_2 = -\dfrac{13.6}{4} = -3.4$ eV.

$K = -E =$ **3.4 eV**, $U = 2E =$ **−6.8 eV**, total **−3.4 eV**.
:::

:::question{title="4. Speed and period" exam="NEET level"}
The electron in the ground state of hydrogen moves at $2.2 \times 10^6$ m/s. Find its speed in the $n = 3$ orbit, and how many times longer one revolution takes there.

---

$v_n \propto \dfrac1n$: $v_3 = \dfrac{2.2 \times 10^6}{3} \approx$ **7.3 × 10⁵ m/s**.

$T = \dfrac{2\pi r}{v} \propto \dfrac{n^2}{1/n} = n^3$, so the period is $3^3 =$ **27 times** longer.
:::

:::question{title="5. Angular momentum" exam="NEET level"}
The electron in a hydrogen atom has total energy $-1.51$ eV. Find its angular momentum. ($h = 6.6 \times 10^{-34}$ J s)

---

$-\dfrac{13.6}{n^2} = -1.51$ gives $n^2 = 9$, so $n = 3$.

$L = \dfrac{3h}{2\pi} = \dfrac{3 \times 6.6 \times 10^{-34}}{2\pi} \approx$ **3.15 × 10⁻³⁴ J s**.
:::

:::question{title="6. Orbit of He⁺" exam="JEE Main level"}
The Bohr radius of hydrogen is 0.53 Å. Find the radius of the $n = 2$ orbit of He⁺ ($Z = 2$). (Exam extra: hydrogen-like ion.)

---

$r_n = 0.53 \times \dfrac{n^2}{Z} = 0.53 \times \dfrac{4}{2} =$ **1.06 Å**.
:::

## Spectrum

:::question{title="7. Wavelength of a jump" exam="NEET level"}
An electron in hydrogen falls from $n = 2$ to $n = 1$. Find the wavelength of the photon and the region of the spectrum. (Take $hc = 1240$ eV nm.)

---

$\Delta E = -3.4 - (-13.6) = 10.2$ eV. $\lambda = \dfrac{1240}{10.2} \approx$ **122 nm**, in the **ultraviolet** (first line of the Lyman series).
:::

:::question{title="8. Electron beam" exam="JEE Main level"}
Hydrogen gas in its ground state is bombarded with **electrons** of energy 12.8 eV. How many different spectral lines can the gas then emit?

---

Energy needed from $n = 1$: to $n = 4$ it is $13.6 - 0.85 = 12.75$ eV (possible); to $n = 5$ it is $13.6 - 0.544 \approx 13.06$ eV (not possible). An electron can give away part of its energy, so atoms reach up to $n = 4$.

Lines $= \dfrac{4 \times 3}{2} =$ **6**.
:::

:::question{title="9. Lyman vs Balmer" exam="JEE Main level"}
Find the ratio of the longest wavelength of the Lyman series to the longest wavelength of the Balmer series of hydrogen. (Exam extra: Rydberg formula.)

---

Longest wavelength = smallest jump.

Lyman, $2 \to 1$: $\dfrac1\lambda = R\left(1 - \dfrac14\right) = \dfrac{3R}{4}$.

Balmer, $3 \to 2$: $\dfrac1\lambda = R\left(\dfrac14 - \dfrac19\right) = \dfrac{5R}{36}$.

$\dfrac{\lambda_L}{\lambda_B} = \dfrac{5/36}{3/4} = \dfrac{20}{108} =$ **5 : 27** (check: $122/656 \approx 0.186$).
:::

## de Broglie

:::question{title="10. Wave on the orbit" exam="JEE Main level"}
The radius of the first Bohr orbit of hydrogen is 0.53 Å. Find the de Broglie wavelength of the electron in the $n = 2$ orbit.

---

$r_2 = 4 \times 0.53 = 2.12$ Å. Two wavelengths fit round the orbit: $2\pi r_2 = 2\lambda$.

$\lambda = \pi r_2 = \pi \times 2.12 \approx$ **6.66 Å**.
:::
