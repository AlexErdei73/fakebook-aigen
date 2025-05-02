import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice";
import currentUserReducer from "../features/currentUser/currentUserSlice";
import usersReducer from "../features/users/usersSlice";
import postsReducer from "../features/posts/postsSlice";
import incomingMessagesReducer from "../features/incomingMessages/incomingMessagesSlice";
import outgoingMessagesReducer from "../features/outgoingMessages/outgoingMessagesSlice";
import linkReducer from "../features/link/linkSlice";
import accountPageReducer from "../features/accountPage/accountPageSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    currentUser: currentUserReducer,
    users: usersReducer,
    posts: postsReducer,
    incomingMessages: incomingMessagesReducer,
    outgoingMessages: outgoingMessagesReducer,
    link: linkReducer,
    accountPage: accountPageReducer,
  },
});

if (import.meta.env.DEV) {
  store.subscribe(() => {
    const s = store.getState();

    console.log("[DEBUG] users:", s.users);

    console.log("[DEBUG] currentUser:", s.currentUser);

    console.log("[DEBUG] posts:", s.posts);
  });
}

export default store;
