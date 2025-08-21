import { parseArrayData } from './utils';
import { useEffect, useRef, useState } from 'react';
import ViewDefault from './defaultECG/viewDefault';
import { graphData } from './allData/data';
import { newData } from './allData/newData';
import ViewATN from './ATNAlgorithm/viewATN';
import ViewPT from './PTAlgorithm/viewPT';
import ViewKHO from './KHOAlgorithm/viewKHO';
import { peaksCollection, saveFile } from './peaksCollection/peaksCollection';
import { PAGE_SIZE, readUploadedFile, streamUploadedFileData } from './fileReader/fileReader';

function App() {
  const [currentView, setCurrentView] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [series, setSeries] = useState(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedSeries, setUploadedSeries] = useState(null);
  const [uploadedSeriesLength, setUploadedSeriesLength] = useState(0);
  const [uploadedSeriesPage, setUploadedSeriesPage] = useState(0);

  const inputRef = useRef(null);

  useEffect(() => {
    if (currentData === 0) {
      setSeries(parseArrayData(graphData));
    } else if (currentData === 1) {
      setSeries(parseArrayData(newData));
    } else if (currentData === 2) {
      setSeries(uploadedSeries);
    }
  }, [currentData]);

  const changeCurrentView = (id) => {
    currentView !== id && setCurrentView(id);
  };

  const changeCurrentData = (id) => {
    currentData !== id && setCurrentData(id);
  };

  const onUploadingFile = (e) => {
    const file = e.target.files[0];
    if (!file) {
      alert('произошла ошибка, попробуйте снова');
    }
    setUploadedSeries(null);
    setUploadedSeriesLength(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      !!series && setSeries(null);
      !!currentData && setCurrentData(null);
      setUploadedFile(file);
      setUploadedSeries(true);
      if (inputRef) {
        inputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const showUploadedFile = async () => {
    const streamData = await streamUploadedFileData(
      uploadedFile,
      PAGE_SIZE * uploadedSeriesPage,
      PAGE_SIZE,
      uploadedSeriesLength,
    );
    // !uploadedSeriesLength && setUploadedSeriesLength(streamData.totalLines - 1);
    // setUploadedSeries(parseArrayData(readUploadedFile(streamData.lines)));
    console.log(streamData, 'strim');
    //changeCurrentData(2);
  };

  const activeStyle = {
    background: 'black',
    color: 'white',
  };

  const blockedStyle = {
    color: 'darkgray',
    background: 'gray',
    pointerEvents: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '80%',
        }}
      >
        <div>
          <button style={currentView === 0 ? activeStyle : {}} onClick={() => changeCurrentView(0)}>
            Стандартный вид (3 канала)
          </button>
          <button style={currentView === 1 ? activeStyle : {}} onClick={() => changeCurrentView(1)}>
            Алгоритм PT
          </button>
          <button style={currentView === 2 ? activeStyle : {}} onClick={() => changeCurrentView(2)}>
            Алгоритм KHO
          </button>
          {/* <button style={currentView === 3 ? activeStyle : {}} onClick={() => changeCurrentView(3)}>
            Алгоритм KHO(2)
          </button> */}
          <button style={currentView === 3 ? activeStyle : {}} onClick={() => changeCurrentView(3)}>
            Алгоритм ATN
          </button>
          <button onClick={(prev) => setUploadedSeriesPage(prev + 1)}>Следующая страница</button>
          <button onClick={(prev) => setUploadedSeriesPage(prev - 1)}>Предыдущая страница</button>
        </div>
        <div>
          <button style={currentData === 0 ? activeStyle : {}} onClick={() => changeCurrentData(0)}>
            Файл 1
          </button>
          <button style={currentData === 1 ? activeStyle : {}} onClick={() => changeCurrentData(1)}>
            Файл 2
          </button>
          {uploadedSeries !== null && (
            <button style={currentData === 2 ? activeStyle : {}} onClick={() => showUploadedFile()}>
              Загруженный файл
            </button>
          )}
          <button>
            <label htmlFor="fileUpload">Загрузить файл</label>
            <input
              key={uploadedSeries?.title}
              type="file"
              id="fileUpload"
              onChange={onUploadingFile}
              ref={inputRef}
              accept=".txt"
              hidden
            />
          </button>
          <button
            style={{ marginLeft: '10px', ...(currentData === null ? blockedStyle : activeStyle) }}
            onClick={() => saveFile(peaksCollection(series))}
          >
            Сохранить результат
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {currentData === null || currentView === null || series === null ? (
          'Выберите файл для построения графиков'
        ) : currentView === 0 ? (
          <ViewDefault series={series} />
        ) : currentView === 1 ? (
          <ViewPT series={series} />
        ) : currentView === 2 ? (
          <ViewKHO series={series} />
        ) : (
          <ViewATN series={series} />
        )}
      </div>
    </div>
  );
}

export default App;
