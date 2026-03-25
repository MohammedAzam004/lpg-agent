import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";
import { getUiText } from "../i18n";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function buildLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 12,
          usePointStyle: true
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(17, 35, 32, 0.08)"
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };
}

function normalizeChartData(chart, palette) {
  return {
    labels: chart?.labels || [],
    datasets: (chart?.datasets || []).map((dataset, index) => ({
      ...dataset,
      borderColor: palette[index % palette.length].borderColor,
      backgroundColor: palette[index % palette.length].backgroundColor,
      tension: 0.35,
      fill: true,
      pointRadius: 4
    }))
  };
}

function TrendCharts({ trends, loading = false, language = "en" }) {
  const text = getUiText(language);
  const priceTrend = normalizeChartData(trends?.priceTrend, [
    {
      borderColor: "#2b76f0",
      backgroundColor: "rgba(43, 118, 240, 0.18)"
    }
  ]);
  const availabilityTrend = normalizeChartData(trends?.availabilityTrend, [
    {
      borderColor: "#1a9b66",
      backgroundColor: "rgba(26, 155, 102, 0.16)"
    },
    {
      borderColor: "#d24c43",
      backgroundColor: "rgba(210, 76, 67, 0.16)"
    }
  ]);

  return (
    <section className="trend-panel">
      <div className="trend-panel__header">
        <div>
          <p className="analytics-panel__eyebrow">Trends</p>
          <h2>{text.analyticsTrendTitle}</h2>
          <p className="trend-panel__copy">{text.analyticsTrendCopy}</p>
        </div>
      </div>

      <div className="trend-panel__grid">
        <article className="chart-card">
          <div className="chart-card__header">
            <h3>{text.chart.priceTrend}</h3>
          </div>
          <div className="chart-card__canvas">
            {loading ? (
              <div className="chart-card__loading">
                <div className="skeleton skeleton--title" />
                <div className="skeleton skeleton--grid" />
              </div>
            ) : (
              <Line data={priceTrend} options={buildLineOptions()} />
            )}
          </div>
        </article>

        <article className="chart-card">
          <div className="chart-card__header">
            <h3>{text.chart.availabilityTrend}</h3>
          </div>
          <div className="chart-card__canvas">
            {loading ? (
              <div className="chart-card__loading">
                <div className="skeleton skeleton--title" />
                <div className="skeleton skeleton--grid" />
              </div>
            ) : (
              <Line data={availabilityTrend} options={buildLineOptions()} />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

export default TrendCharts;
