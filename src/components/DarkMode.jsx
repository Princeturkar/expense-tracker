// src/components/DarkMode.jsx

function DarkMode() {

  const toggleDark = () => {
    document.body.classList.toggle("bg-dark");
    document.body.classList.toggle("text-white");
  };

  return (
    <button
      className="btn btn-secondary ms-2"
      onClick={toggleDark}
    >
      Dark Mode
    </button>
  );
}

export default DarkMode;