<template>
  <div class="landing-page">
    <div class="landing-hero">
      <div class="hero-content">
        <h1 class="hero-title">Course & Room Scheduling Made Easy</h1>
        <p class="hero-subtitle">
          Streamline your academic scheduling with intelligent resource allocation
          and real-time conflict resolution
        </p>
        <button class="hero-cta" @click="navigateToLogin">
          Get Started
        </button>
      </div>
      <div class="hero-visual">
        <div class="visual-icon">📚</div>
      </div>
    </div>

    <section class="features-section">
      <h2 class="section-title">Powerful Features</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⏱️</div>
          <h3 class="feature-title">Smart Scheduling</h3>
          <p class="feature-description">
            Intelligent algorithms handle complex scheduling conflicts automatically
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3 class="feature-title">Optimal Resource Allocation</h3>
          <p class="feature-description">
            Maximize room utilization and minimize scheduling conflicts
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">👥</div>
          <h3 class="feature-title">Faculty Management</h3>
          <p class="feature-description">
            Easy course and professor management with preference support
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3 class="feature-title">Real-time Analytics</h3>
          <p class="feature-description">
            Track scheduling metrics and view comprehensive audit logs
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚙️</div>
          <h3 class="feature-title">Flexible Configuration</h3>
          <p class="feature-description">
            Customize constraints and scheduling parameters for your institution
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📈</div>
          <h3 class="feature-title">Data Export</h3>
          <p class="feature-description">
            Export schedules and reports in multiple formats for further analysis
          </p>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <h2>Ready to optimize your schedule?</h2>
      <button class="cta-button" @click="navigateToLogin">
        Log In to Your Account
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  hideTopBar: true,
})

const navigateToLogin = () => {
  navigateTo('/auth/login')
}
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--color-bg) 0%,
    var(--color-surface) 100%
  );
  overflow-x: hidden;
}

/* Hero Section */
.landing-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 3rem;
  padding: 6rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
  background: linear-gradient(
    120deg,
    var(--color-text-primary) 0%,
    var(--color-text-secondary) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.hero-cta {
  align-self: flex-start;
  padding: 1rem 2rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-action-primary-text);
  background: var(--color-action-primary-bg);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
}

.hero-cta:hover {
  background: var(--color-action-primary-bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.hero-cta:active {
  transform: translateY(0);
}

.hero-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.visual-icon {
  font-size: 12rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* Features Section */
.features-section {
  padding: 6rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  background: var(--color-bg);
}

.section-title {
  margin: 0 0 3rem;
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  color: var(--color-text-primary);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-action-primary-bg);
  box-shadow: 0 8px 24px var(--color-shadow);
}

.feature-icon {
  font-size: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.feature-description {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* CTA Section */
.cta-section {
  padding: 6rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
}

.cta-section h2 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.cta-button {
  padding: 1rem 2.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-action-primary-text);
  background: var(--color-action-primary-bg);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
}

.cta-button:hover {
  background: var(--color-action-primary-bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.cta-button:active {
  transform: translateY(0);
}

/* Responsive Design */
@media (max-width: 768px) {
  .landing-hero {
    grid-template-columns: 1fr;
    padding: 4rem 1.5rem;
    gap: 2rem;
  }

  .hero-visual {
    min-height: 200px;
  }

  .visual-icon {
    font-size: 8rem;
  }

  .section-title {
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  .features-section {
    padding: 4rem 1.5rem;
  }

  .cta-section {
    padding: 4rem 1.5rem;
  }

  .hero-title {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .landing-hero {
    padding: 2rem 1rem;
    gap: 1.5rem;
  }

  .hero-title {
    font-size: 1.5rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-cta,
  .cta-button {
    padding: 0.875rem 1.75rem;
    font-size: 1rem;
  }

  .visual-icon {
    font-size: 6rem;
  }

  .features-grid {
    gap: 1.5rem;
  }

  .feature-card {
    padding: 1.5rem;
  }
}
</style>
