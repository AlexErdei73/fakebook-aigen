import React, { useState, useEffect, useRef, useMemo } from "react";

import {
  Row,
  Col,
  DropdownButton,
  Dropdown,
  Button,
  Nav,
  Navbar,
} from "react-bootstrap";

import {
  Link,
  Switch,
  Route,
  useRouteMatch,
  useParams,
} from "react-router-dom";

import { MdPhotoCamera } from "react-icons/md";

import { IoTrashOutline } from "react-icons/io5";

import { ImUpload2 } from "react-icons/im";

import { HiOutlinePhotograph } from "react-icons/hi";

import CircularImage from "./CircularImage";

import NestedRoute from "./NestedRoute";

import RemoveCoverPhotoDlg from "./RemoveCoverPhotoDlg";

import SelectBgPhotoModal from "./SelectBgPhotoModal";

import UpdateProfilePicModal from "./UpdateProfilePicModal";

import UploadPhoto from "./UploadPhoto";

import Posts from "./Posts";

import StorageImage from "./StorageImage";

import "./Profile.css";

import { useDispatch, useSelector } from "react-redux";

import { updateProfile } from "../backend/backend";

import { linkUpdated } from "../features/link/linkSlice";

const Profile = () => {
  const { userName } = useParams();

  const dispatch = useDispatch();

  const meID = useSelector((s) => s.user.id); // logged-in id

  const users = useSelector((s) => s.users);

  const link = useSelector((s) => s.link);

  /* ------------------------------------------------------------------

     Resolve the viewed profile once (re-runs when users or url change)

     ------------------------------------------------------------------ */

  const profile = useMemo(() => {
    if (!users?.length) return null;

    const aliases = users.map((u) =>
      !u.index || u.index === 0
        ? `${u.lastname}.${u.firstname}`
        : `${u.lastname}.${u.firstname}.${u.index}`
    );

    const idx = aliases.indexOf(userName);

    return idx === -1 ? null : users[idx];
  }, [users, userName]);

  /* still loading or invalid username → simple fallback  */

  if (!profile) return <p className='text-center mt-5'>Loading …</p>;

  const {
    userID, // id of the profile we view

    firstname,

    lastname,

    profilePictureURL,

    backgroundPictureURL,

    photos = [],
  } = profile;

  const isCurrentUser = meID === userID;

  /* ---------------- Local UI state ---------------- */

  const [showRemoveCoverPhotoDlg, setShowRemoveCoverPhotoDlg] = useState(false);

  const [showSelectPhoto, setShowSelectPhoto] = useState(false);

  const [showUpdateProfilePic, setShowUpdateProfilePic] = useState(false);

  const [showUploadPhotoDlg, setShowUploadPhotoDlg] = useState(false);

  const [nameOfURL, setNameOfURL] = useState("backgroundPictureURL");

  const [activeLink, setActiveLink] = useState(null);

  /* refs for the “active link” helper */

  const photosLinkRef = useRef(null);

  const friendsLinkRef = useRef(null);

  const postsLinkRef = useRef(null);

  const linkHandlingProps = {
    linkRefs: {
      photos: photosLinkRef,
      friends: friendsLinkRef,
      posts: postsLinkRef,
    },

    linkState: [activeLink, setActiveLink],
  };

  const { url, path } = useRouteMatch();

  /* ---------- helper fns (unchanged except userID var names) ----- */

  function openFileInput(name) {
    setNameOfURL(name);
    setShowUploadPhotoDlg(true);
  }

  function handleSelect(key) {
    if (key === "3") setShowRemoveCoverPhotoDlg(true);
    else if (key === "2") openFileInput("backgroundPictureURL");
    else if (key === "1") setShowSelectPhoto(true);
  }

  function closeDlg() {
    setShowRemoveCoverPhotoDlg(false);
  }

  const removeCoverPhoto = () => (
    closeDlg(), updateProfile({ backgroundPictureURL: "background-server.jpg" })
  );

  const hideBgPhotoModal = () => setShowSelectPhoto(false);

  const hideProfilePicModal = () => setShowUpdateProfilePic(false);

  function handlePhotoClick(e, field) {
    const idx = Number(e.target.id);

    const file = photos[idx]?.fileName;

    if (!file) return;

    updateProfile({ [field]: `${userID}/${file}` });
  }

  function updatePhotos(file) {
    const filenames = photos.map((p) => p.fileName);

    const newPhotos = filenames.includes(file.name)
      ? photos
      : [...photos, { fileName: file.name }];

    const patch = { photos: newPhotos };

    if (nameOfURL) patch[nameOfURL] = `${userID}/${file.name}`;

    return updateProfile(patch);
  }

  /* ----------------------------------------------------------

   helpers that the JSX at the bottom expects

   ---------------------------------------------------------- */

  /* background-photo picker in SelectBgPhotoModal */

  function handleBgPhotoClick(e) {
    hideBgPhotoModal(); // close the modal

    handlePhotoClick(e, "backgroundPictureURL");
  }

  /* “Upload Photo” button in UpdateProfilePicModal */

  function handleUploadProfilePicClick() {
    hideProfilePicModal(); // close the modal

    openFileInput("profilePictureURL"); // open file chooser
  }

  /* Pick an existing picture as the new profile picture */

  function handleProfilePicClick(e) {
    hideProfilePicModal(); // close modal

    handlePhotoClick(e, "profilePictureURL");
  }

  /* -------- set the active top-bar link on mount ----------------- */

  useEffect(() => {
    if (link.active !== "friends" || window.innerWidth < 600)
      dispatch(linkUpdated("profile"));
  }, [dispatch, link]);

  /* ------------------------------------------------------------------

     RENDER – everything below is the original markup

     (only userId() → userID replacements)

     ------------------------------------------------------------------ */
  return (
    <>
      <Row className='justify-content-center grad'>
        <Col className='m-0 p-0 profile-col'>
          <div className='background-pic-container'>
            <StorageImage
              className='background-pic'
              storagePath={backgroundPictureURL}
              alt=''
            />
            {isCurrentUser && (
              <DropdownButton
                variant='light'
                className='background-pic-button'
                title={
                  <b>
                    <MdPhotoCamera className='mr-1' size='20px' />
                    <span>Edit Cover Photo</span>
                  </b>
                }
                size='sm'
              >
                <Dropdown.Item eventKey='1' onSelect={handleSelect}>
                  <HiOutlinePhotograph size='20px' className='mr-2' />
                  Select Photo
                </Dropdown.Item>
                <Dropdown.Item eventKey='2' onSelect={handleSelect}>
                  <ImUpload2 size='20px' className='mr-2' />
                  Upload Photo
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item eventKey='3' onSelect={handleSelect}>
                  <IoTrashOutline size='20px' className='mr-2' /> Remove
                </Dropdown.Item>
              </DropdownButton>
            )}
            <div className='profile-pic-container'>
              <CircularImage size='180' url={profilePictureURL} />
              {isCurrentUser && (
                <Button
                  variant='light'
                  className='profile-pic-button'
                  onClick={() => setShowUpdateProfilePic(true)}
                >
                  <MdPhotoCamera size='19px' aria-label='photo' />
                </Button>
              )}
            </div>
          </div>
          <h2 className='text-center mt-5'>
            <b>
              {firstname} {lastname}
            </b>
          </h2>
          <hr></hr>
          <Navbar bg='light'>
            <Nav>
              <Nav.Item>
                <Link
                  key='1'
                  to={`${url}/Posts`}
                  className='nav-link mx-2'
                  ref={postsLinkRef}
                >
                  <b>Posts</b>
                </Link>
              </Nav.Item>
              <Nav.Item>
                <Link
                  key='2'
                  to={`${url}/Friends`}
                  className='nav-link mx-2'
                  ref={friendsLinkRef}
                >
                  <b>Friends</b> {users.length}
                </Link>
              </Nav.Item>
              <Nav.Item>
                <Link
                  key='3'
                  to={`${url}/Photos`}
                  className='nav-link mx-2'
                  ref={photosLinkRef}
                >
                  <b>Photos</b>
                </Link>
              </Nav.Item>
            </Nav>
          </Navbar>
        </Col>
      </Row>
      <Row className='justify-content-center'>
        <Col className='profile-col'>
          <Switch>
            <Route path={`${path}/:itemId`}>
              <NestedRoute
                userID={userID}
                openFileInput={() => openFileInput("")}
                //we only need the rest to handle the changes of the activeLink
                linkHandling={linkHandlingProps}
              />
            </Route>
            <Route path={path}>
              <Posts
                userID={userID}
                //we only need the rest to handle the changes of the activeLink
                linkHandling={linkHandlingProps}
              />
            </Route>
          </Switch>
        </Col>
      </Row>

      <RemoveCoverPhotoDlg
        show={showRemoveCoverPhotoDlg}
        removeCoverPhoto={removeCoverPhoto}
        closeDlg={closeDlg}
      />

      <SelectBgPhotoModal
        show={showSelectPhoto}
        onHide={hideBgPhotoModal}
        onPhotoClick={handleBgPhotoClick}
        userID={userID}
        photos={photos}
      />

      <UpdateProfilePicModal
        show={showUpdateProfilePic}
        onHide={hideProfilePicModal}
        onBtnClick={handleUploadProfilePicClick}
        onPhotoClick={handleProfilePicClick}
        userID={userID}
        photos={photos}
      />

      <UploadPhoto
        show={showUploadPhotoDlg}
        setShow={setShowUploadPhotoDlg}
        updateDatabase={updatePhotos}
        userID={userID}
      />
    </>
  );
};

export default Profile;
