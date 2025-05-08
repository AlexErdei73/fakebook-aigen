import React from "react";
// For Bootstrap 4: use "sr-only" for visually hidden text

const CustomToggle = React.forwardRef(({ onClick }, ref) => (
  <button
    ref={ref}
    className='btn dropdown-toggle custom-drop-down-btn'
    aria-label='Account menu'
    data-toggle='dropdown'
    aria-haspopup='true'
    aria-expanded='false'
    type='button'
    onClick={(e) => {
      e.preventDefault();

      onClick(e);
    }}
  >
    <span className='sr-only'>Account menu</span>

    {/* Bootstrap's caret will appear via .dropdown-toggle CSS */}
  </button>
));

export default CustomToggle;
